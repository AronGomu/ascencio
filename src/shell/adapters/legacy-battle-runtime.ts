import type {
  ContentReadPort,
  ContentSetRef,
  InstalledGameplay,
} from "../../content/index.ts";
import { installedDeckCatalog } from "../../decks/index.ts";
import { PROTOTYPE_RULESET } from "../../decks/validation/index.ts";
import { cardCode } from "../../cards/index.ts";
import {
  parseBattleRuntimeInput,
  type BattlePresentationInput,
  type BattleRuntimeCard,
  type BattleRuntimeInput,
  type BattleRuntimeSource,
} from "../../battle/ports/index.ts";

interface RuntimeManifest {
  readonly snapshotId: string;
  readonly engine: { readonly coreVersion: readonly [number, number] };
  readonly assets: {
    readonly babelCdbRevision: string;
    readonly cardScriptsRevision: string;
    readonly files: readonly { readonly path: string }[];
  };
}

interface RuntimeScriptIndex {
  readonly official: readonly string[];
  readonly preRelease: readonly string[];
  readonly globals: readonly string[];
  readonly shardCount: number;
}

export function legacyBattlePresentation(
  gameplay: InstalledGameplay,
): BattlePresentationInput {
  return Object.freeze({
    snapshotId: gameplay.content.snapshot.runtimeSnapshotId,
    catalogRevision: gameplay.content.catalogSha256,
    cards: installedDeckCatalog(gameplay).cards,
    decks: Object.freeze(
      gameplay.decks.map(({ id, name, main, extra, side }) =>
        Object.freeze({ id, name, main, extra, side }),
      ),
    ),
    opponents: Object.freeze(
      gameplay.opponents.map(({ id, name, line, deckId }) =>
        Object.freeze({ id, name, line, deckId }),
      ),
    ),
    defaults: Object.freeze({ ...gameplay.defaults }),
  });
}

/** Temporary legacy bridge removed when T9 supplies selected progressive input. */
export function createLegacyBattleRuntimeSource(
  reader: ContentReadPort,
  gameplay: InstalledGameplay,
): BattleRuntimeSource {
  const ref = gameplay.content;
  const allowedCardCodes = Object.freeze(
    [...new Set(gameplay.cards.map(({ code }) => cardCode(code)))].sort(
      (left, right) => left - right,
    ),
  );
  return Object.freeze({
    async load(signal: AbortSignal): Promise<BattleRuntimeInput> {
      signal.throwIfAborted();
      const acquired = await reader.acquireSession(ref);
      if (acquired.kind === "failed")
        throw new Error("APP_REQUIRED_INPUT_FAILED");
      try {
        const runtimeManifest = await readJson<RuntimeManifest>(
          reader,
          ref,
          "runtime/current/manifest.json",
          signal,
        );
        if (runtimeManifest.snapshotId !== ref.snapshot.runtimeSnapshotId)
          throw new Error("APP_REQUIRED_INPUT_FAILED");
        const paths = runtimeManifest.assets.files.map(({ path }) => path);
        const cardPaths = paths
          .filter((path) => /^catalog\/cards\/[a-f0-9]{2}\.json$/.test(path))
          .sort();
        const textPaths = paths
          .filter((path) =>
            /^catalog\/texts\/en\/[a-f0-9]{2}\.json$/.test(path),
          )
          .sort();
        const scriptPaths = paths
          .filter((path) => /^scripts\/cards\/[a-f0-9]{2}\.json$/.test(path))
          .sort();
        if (
          cardPaths.length === 0 ||
          textPaths.length === 0 ||
          scriptPaths.length === 0
        )
          throw new Error("APP_REQUIRED_INPUT_FAILED");

        const [
          cardShards,
          textShards,
          scriptShards,
          scriptIndex,
          globals,
          strings,
        ] = await Promise.all([
          readJsonFiles<readonly BattleRuntimeCard[]>(
            reader,
            ref,
            cardPaths,
            signal,
          ),
          readJsonFiles<
            readonly {
              readonly code: number;
              readonly name: string;
              readonly description: string;
              readonly strings: readonly string[];
            }[]
          >(reader, ref, textPaths, signal),
          readJsonFiles<Readonly<Record<string, string>>>(
            reader,
            ref,
            scriptPaths,
            signal,
          ),
          readJson<RuntimeScriptIndex>(
            reader,
            ref,
            "runtime/assets/current/scripts/index.json",
            signal,
          ),
          readJson<Readonly<Record<string, string>>>(
            reader,
            ref,
            "runtime/assets/current/scripts/globals.json",
            signal,
          ),
          readJson<BattleRuntimeInput["strings"]>(
            reader,
            ref,
            "runtime/assets/current/strings/en.json",
            signal,
          ),
        ]);
        if (scriptIndex.shardCount !== 256)
          throw new Error("APP_REQUIRED_INPUT_FAILED");

        const cards = cardShards
          .flat()
          .map((card) => ({
            code: cardCode(Number(card.code)),
            alias: card.alias,
            setcodes: card.setcodes,
            type: card.type,
            level: card.level,
            attribute: card.attribute,
            race: card.race,
            attack: card.attack,
            defense: card.defense,
            lscale: card.lscale,
            rscale: card.rscale,
            linkMarker: card.linkMarker,
          }))
          .sort((left, right) => left.code - right.code);
        const texts = textShards
          .flat()
          .map((text) => ({ ...text, code: cardCode(text.code) }))
          .sort((left, right) => left.code - right.code);
        const scriptMap = new Map<string, string>();
        for (const shard of scriptShards)
          for (const [name, source] of Object.entries(shard))
            scriptMap.set(name, source);
        for (const [name, source] of Object.entries(globals))
          scriptMap.set(name, source);
        const scripts = [...scriptMap]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, source]) => ({ name, source }));
        const supported = new Set(cards.map(({ code }) => Number(code)));
        const requiredCardScripts = [
          ...scriptIndex.official,
          ...scriptIndex.preRelease,
        ]
          .filter((name) => {
            const matched = /^c([1-9]\d*)\.lua$/.exec(name);
            return matched !== null && supported.has(Number(matched[1]));
          })
          .sort();
        const wasmBinary = await readBytes(
          reader,
          ref,
          "runtime/engine/ocgcore.sync.wasm",
          signal,
        );
        const input = parseBattleRuntimeInput({
          schemaVersion: 1,
          snapshotId: runtimeManifest.snapshotId,
          coreVersion: runtimeManifest.engine.coreVersion,
          wasmBinary,
          cards,
          texts,
          scripts,
          requiredScripts: {
            cards: [...new Set(requiredCardScripts)],
            globals: [...new Set(scriptIndex.globals)].sort(),
          },
          strings,
          allowedCardCodes,
          ruleset: {
            id: PROTOTYPE_RULESET.id,
            revision: PROTOTYPE_RULESET.revision,
            quantityByCode: [...PROTOTYPE_RULESET.quantityByCode]
              .filter(([code]) => supported.has(code))
              .sort(([left], [right]) => left - right),
          },
          revisions: {
            babelCdb: runtimeManifest.assets.babelCdbRevision,
            cardScripts: runtimeManifest.assets.cardScriptsRevision,
          },
        });
        signal.throwIfAborted();
        return input;
      } catch (error) {
        signal.throwIfAborted();
        if (
          error instanceof Error &&
          error.message === "BATTLE_RUNTIME_INVALID"
        )
          throw error;
        throw new Error("APP_REQUIRED_INPUT_FAILED", { cause: error });
      } finally {
        acquired.value.release();
      }
    },
  });
}

async function readJsonFiles<T>(
  reader: ContentReadPort,
  ref: ContentSetRef,
  paths: readonly string[],
  signal: AbortSignal,
): Promise<readonly T[]> {
  const result: T[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, paths.length) }, async () => {
      while (next < paths.length) {
        const path = paths[next++];
        if (path === undefined) return;
        result.push(
          await readJson<T>(
            reader,
            ref,
            `runtime/assets/current/${path}`,
            signal,
          ),
        );
      }
    }),
  );
  return result;
}

async function readJson<T>(
  reader: ContentReadPort,
  ref: ContentSetRef,
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const bytes = await readBytes(reader, ref, path, signal);
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as T;
  } catch (error) {
    throw new Error("APP_REQUIRED_INPUT_FAILED", { cause: error });
  }
}

async function readBytes(
  reader: ContentReadPort,
  ref: ContentSetRef,
  path: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  const result = await reader.readFile(ref.runtime, path);
  if (result.kind === "failed") throw new Error("APP_REQUIRED_INPUT_FAILED");
  const bytes = await result.value.arrayBuffer();
  signal.throwIfAborted();
  return bytes;
}
