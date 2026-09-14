import type { DeckBuilderCardView } from "../../decks/catalog/index.ts";
import type { PinnedDeckRuleset } from "../../decks/validation/index.ts";
import { OCG_TYPE, hasOcgType } from "../../cards/classification/index.ts";
import { snapshotId } from "../duel/contracts/ids.ts";
import {
  parseBattleRuntimeInput,
  validateBattleRuntime,
  type BattleRuntimeInput,
} from "../ports/index.ts";
import type { ActiveDuelDependencies } from "./assets/active-duel-dependencies.ts";
import {
  safeWorkerLogger,
  workerLog,
  type WorkerLogger,
} from "./diagnostics/worker-log.ts";
import { DuelWorkerRuntime } from "./DuelWorkerRuntime.ts";
import { OcgCoreAdapter } from "./engine/OcgCoreAdapter.ts";
import { runDuelRuntimeInitializationStage } from "./runtime-initialization.ts";

// vendor/ocgcore-wasm/0.1.2/vendor-manifest.json: lib/ocgcore.sync.wasm.
const FROZEN_WASM_SHA256 =
  "7415337a6f88653b38e10faa3a087c0a5ab64dd27a7d7cf8a1e6872747c5c265";

export interface BrowserDuelWorkerRuntimeOptions {
  readonly logger?: WorkerLogger;
}

export function createBrowserDuelWorkerRuntime(
  options: BrowserDuelWorkerRuntimeOptions = {},
): DuelWorkerRuntime {
  const runtimeId = globalThis.crypto.randomUUID();
  const logger = safeWorkerLogger(options.logger ?? workerLog);

  return new DuelWorkerRuntime(
    async (progress, signal, value) => {
      signal.throwIfAborted();
      progress("runtime-input", 0.05);
      const input = await runDuelRuntimeInitializationStage(
        "snapshot_validation_failed",
        "Unable to validate the runtime snapshot",
        async () => {
          const parsed = parseBattleRuntimeInput(value);
          validateBattleRuntime(parsed);
          const digest = new Uint8Array(
            await crypto.subtle.digest("SHA-256", parsed.wasmBinary),
          );
          const sha256 = Array.from(digest, (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          if (sha256 !== FROZEN_WASM_SHA256)
            throw new Error("BATTLE_RUNTIME_INVALID");
          return parsed;
        },
      );
      signal.throwIfAborted();
      progress("engine", 0.4);
      const adapter = await runDuelRuntimeInitializationStage(
        "engine_initialization_failed",
        "Unable to initialize the vendored engine",
        async () => {
          const adapter = await OcgCoreAdapter.initialize({
            wasmBinary: input.wasmBinary,
            onDiagnostic: ({ stream, message }) =>
              logger[stream === "stderr" ? "warn" : "debug"]({
                event: "duel.worker.engine.initialization.diagnostic",
                runtimeId,
                stream,
                message,
              }),
          });
          const coreVersion = adapter.getVersion();
          if (
            coreVersion[0] !== input.coreVersion[0] ||
            coreVersion[1] !== input.coreVersion[1]
          )
            throw new Error(
              "Vendored engine version does not match the runtime snapshot",
            );
          return adapter;
        },
      );
      signal.throwIfAborted();

      progress("dependencies", 0.75);
      const dependencies = await runDuelRuntimeInitializationStage(
        "dependency_resolution_failed",
        "Unable to resolve duel dependencies",
        async () => runtimeDependencies(input),
      );
      signal.throwIfAborted();
      progress("ready", 1);
      return {
        adapter,
        dependencies,
        createPreset: () => {
          throw new Error(
            "Semantic runtime input does not expose bundled presets",
          );
        },
        allowedCardCodes: new Set(input.allowedCardCodes),
        deckCatalog: runtimeDeckCatalog(input),
        deckRuleset: runtimeRuleset(input),
        allowPresetDecks: false,
        snapshotId: snapshotId(input.snapshotId),
        revisions: {
          babelCdb: input.revisions.babelCdb,
          cardScripts: input.revisions.cardScripts,
          distribution: "runtime-input-v1",
          activeImageManifestSha256: input.snapshotId,
        },
      };
    },
    { runtimeId, logger },
  );
}

function runtimeDependencies(
  input: BattleRuntimeInput,
): ActiveDuelDependencies {
  const cards = new Map(
    input.cards.map((card) => [
      Number(card.code),
      Object.freeze({
        code: Number(card.code),
        alias: card.alias,
        setcodes: [...card.setcodes],
        type: card.type,
        level: card.level,
        attribute: card.attribute,
        race: BigInt(card.race),
        attack: card.attack,
        defense: card.defense,
        lscale: card.lscale,
        rscale: card.rscale,
        link_marker: card.linkMarker,
      }),
    ]),
  );
  const texts = new Map(
    input.texts.map((text) => [Number(text.code), text] as const),
  );
  const scripts = new Map(
    input.scripts.map(({ name, source }) => [name, source] as const),
  );
  return Object.freeze({
    cards,
    texts,
    scripts,
    strings: input.strings,
    images: new Map(),
    counts: Object.freeze({
      cards: cards.size,
      texts: texts.size,
      scripts: scripts.size,
      globals: input.requiredScripts.globals.length,
      images: 0,
    }),
  });
}

function runtimeDeckCatalog(
  input: BattleRuntimeInput,
): ReadonlyMap<number, DeckBuilderCardView> {
  const texts = new Map(input.texts.map((text) => [Number(text.code), text]));
  return new Map(
    input.cards.map((card) => {
      const text = texts.get(Number(card.code))!;
      const extra =
        hasOcgType(card.type, OCG_TYPE.FUSION) ||
        hasOcgType(card.type, OCG_TYPE.SYNCHRO) ||
        hasOcgType(card.type, OCG_TYPE.XYZ) ||
        hasOcgType(card.type, OCG_TYPE.LINK);
      return [
        Number(card.code),
        {
          code: Number(card.code),
          name: text.name,
          description: text.description,
          family: hasOcgType(card.type, OCG_TYPE.SPELL)
            ? "spell"
            : hasOcgType(card.type, OCG_TYPE.TRAP)
              ? "trap"
              : "monster",
          subtypes: [],
          attribute: null,
          race: null,
          levelRankLink: null,
          ratingLabel: null,
          attack: null,
          defense: null,
          pendulumScales: null,
          linkMarkers: [],
          canonicalZone: extra ? "extra" : "main",
          imageUrl: null,
          scope: 3,
          rawType: card.type,
        },
      ] as const;
    }),
  );
}

function runtimeRuleset(input: BattleRuntimeInput): PinnedDeckRuleset {
  return Object.freeze({
    id: input.ruleset.id,
    revision: input.ruleset.revision,
    quantityByCode: new Map(input.ruleset.quantityByCode),
  });
}
