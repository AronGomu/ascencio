import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  parseBattleRuntimeInput,
  validateFrozenBattleExecutable,
  type BattleRuntimeInput,
  type BattleRuntimeSource,
} from "../../battle/ports/index.ts";
import type { Cards } from "../../cards/index.ts";
import { OCG_TYPE, hasOcgType } from "../../cards/classification/index.ts";
import type {
  ActivePackage,
  CardLibraryConfig,
  ContentQueries,
  DuelCoreConfig,
  PackageId,
  QueryMap,
  StorageFailure,
} from "../../storage/index.ts";

const PAGE_SIZE = 500;
export interface SqliteBattleRulesetInput {
  readonly id: string;
  readonly revisionPackageId: PackageId;
  readonly limits: readonly (readonly [number, 0 | 1 | 2])[];
  readonly allowedCardCodes?: ReadonlySet<number>;
}

export interface SqliteBattleRuntimeOptions {
  readonly content: ContentQueries;
  readonly packages: readonly ActivePackage[];
  readonly cards: Cards;
  readonly core: DuelCoreConfig;
  readonly library: CardLibraryConfig;
  readonly ruleset: SqliteBattleRulesetInput;
}

export function createSqliteBattleRuntimeSource(
  options: SqliteBattleRuntimeOptions,
): BattleRuntimeSource {
  const identities = dependencyPackages(
    options.packages,
    options.ruleset.revisionPackageId,
  );
  const snapshotId = runtimeSnapshotId(
    options.packages,
    options.ruleset.revisionPackageId,
  );
  const rulesetIdentity = requiredPackage(
    identities,
    options.ruleset.revisionPackageId,
  );
  return Object.freeze({
    async load(signal: AbortSignal): Promise<BattleRuntimeInput> {
      throwIfAborted(signal);
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      try {
        const [wasmAsset, vendorAsset, scripts] = await Promise.all([
          requiredAsset(
            options.content,
            "duel-core",
            options.core.wasmPath,
            controller.signal,
          ),
          requiredAsset(
            options.content,
            "duel-core",
            options.core.vendorManifestPath,
            controller.signal,
          ),
          readAllScripts(options.content, controller.signal),
        ]);
        throwIfAborted(signal);
        const wasm = wasmAsset.bytes.slice();
        const vendorManifest = vendorAsset.bytes.slice();
        await validateFrozenBattleExecutable(vendorManifest, wasm);
        throwIfAborted(signal);
        const wasmBinary = wasm.buffer;
        Object.freeze(wasmBinary);

        const definitions = options.cards.all();
        return parseBattleRuntimeInput({
          schemaVersion: 1,
          snapshotId,
          coreVersion: options.core.coreVersion,
          wasmBinary,
          cards: definitions.map((card) => ({
            code: card.code,
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
          })),
          texts: definitions.map((card) => ({
            code: card.code,
            name: card.name,
            description: card.description,
            strings: card.strings,
          })),
          scripts,
          requiredScripts: options.library.requiredScripts,
          strings: options.core.strings,
          allowedCardCodes: definitions
            .filter(
              (card) =>
                !hasOcgType(card.type, OCG_TYPE.TOKEN) &&
                (card.scope & 8) === 0 &&
                (options.ruleset.allowedCardCodes === undefined ||
                  options.ruleset.allowedCardCodes.has(card.code)),
            )
            .map(({ code }) => code),
          ruleset: {
            id: options.ruleset.id,
            revision: `${rulesetIdentity.version}:${rulesetIdentity.sha256}`,
            quantityByCode: options.ruleset.limits.map(([code, quantity]) => [
              code,
              quantity,
            ]),
          },
          revisions: options.library.revisions,
        });
      } catch (error) {
        controller.abort();
        throwIfAborted(signal);
        if (
          error instanceof Error &&
          error.message === "BATTLE_RUNTIME_INVALID"
        )
          throw error;
        throw new Error("APP_REQUIRED_INPUT_FAILED", { cause: error });
      } finally {
        signal.removeEventListener("abort", abort);
      }
    },
  });
}

export function runtimeSnapshotId(
  packages: readonly ActivePackage[],
  rootPackageId: PackageId = "freeplay",
): string {
  const canonical = JSON.stringify(
    dependencyPackages(packages, rootPackageId).map(
      ({ packageId, version, sha256 }) => ({
        packageId,
        version,
        sha256,
      }),
    ),
  );
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

async function readAllScripts(
  content: ContentQueries,
  signal: AbortSignal,
): Promise<QueryMap["scripts"]> {
  const scripts: QueryMap["scripts"][number][] = [];
  let afterName = "";
  while (true) {
    throwIfAborted(signal);
    const result = await content.query(
      { kind: "scripts", afterName, limit: PAGE_SIZE },
      signal,
    );
    if (result.kind === "failed") throw storageError(result.error);
    const page = result.value;
    if (page.length === 0) break;
    for (const script of page) {
      if (script.name <= afterName)
        throw new Error("APP_REQUIRED_INPUT_FAILED");
      afterName = script.name;
      scripts.push(Object.freeze({ ...script }));
    }
    if (page.length < PAGE_SIZE) break;
  }
  return Object.freeze(scripts);
}

async function requiredAsset(
  content: ContentQueries,
  packageId: PackageId,
  path: string,
  signal: AbortSignal,
): Promise<NonNullable<QueryMap["asset"]>> {
  const result = await content.query(
    { kind: "asset", packageId, path },
    signal,
  );
  if (result.kind === "failed") throw storageError(result.error);
  if (result.value === null) throw new Error("APP_REQUIRED_INPUT_FAILED");
  return result.value;
}

function dependencyPackages(
  packages: readonly ActivePackage[],
  rootPackageId: PackageId,
): readonly ActivePackage[] {
  const found = new Map<PackageId, ActivePackage>();
  const visit = (packageId: PackageId): void => {
    if (found.has(packageId)) return;
    const active = requiredPackage(packages, packageId);
    found.set(packageId, active);
    for (const dependency of active.dependencies) visit(dependency.packageId);
  };
  visit(rootPackageId);
  for (const active of packages)
    if (active.packageType === "card-library") visit(active.packageId);
  return Object.freeze(
    [...found.values()].sort((left, right) =>
      left.packageId.localeCompare(right.packageId),
    ),
  );
}

function requiredPackage(
  packages: readonly ActivePackage[],
  packageId: PackageId,
): ActivePackage {
  const matches = packages.filter((active) => active.packageId === packageId);
  if (matches.length !== 1) throw new Error("APP_REQUIRED_INPUT_FAILED");
  return matches[0]!;
}

function storageError(error: StorageFailure): Error {
  if (error.code === "OPERATION_CANCELLED") return abortError();
  return new Error(error.code, { cause: error });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}
