import { createCards } from "../../cards/index.ts";
import { cardsDeckCatalog } from "../../decks/catalog/index.ts";
import { cloneCardLists } from "../../decks/contracts/index.ts";
import {
  validatePublishedDecks,
  type PinnedDeckRuleset,
} from "../../decks/validation/index.ts";
import type {
  ActivePackage,
  FreeplayConfig,
  LocalStorageClient,
  QueryMap,
  StorageFailure,
} from "../../storage/index.ts";
import type { FreeplayInputs } from "../core/sqlite-sessions.ts";
import type { ShellUserServices } from "../core/user-services.ts";
import { packageReadiness } from "./package-readiness.ts";
import {
  createSqliteBattleRuntimeSource,
  runtimeSnapshotId,
} from "./sqlite-battle-runtime.ts";
import { createSqliteCardImageSource } from "./sqlite-image-source.ts";
import {
  isCardLibraryConfig,
  isDuelCoreConfig,
  query,
  readAllCards,
  readConfig,
} from "./sqlite-content-inputs.ts";

export interface LoadedFreeplayInputs extends FreeplayInputs {
  close(): void;
}

export function closeFreeplayInputs(inputs: FreeplayInputs): void {
  const close = (inputs as Partial<LoadedFreeplayInputs>).close;
  if (typeof close === "function") close();
}

export async function loadFreeplayInputs(
  storage: LocalStorageClient,
  users: ShellUserServices,
  signal: AbortSignal,
): Promise<LoadedFreeplayInputs> {
  throwIfAborted(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  try {
    const current = await storage.packages.current();
    if (current.kind === "failed") throw storageError(current.error);
    if (!packageReadiness(current.value).freeplay)
      throw new Error("APP_REQUIRED_INPUT_FAILED");
    const packages = requiredPackages(current.value.packages);
    const [
      core,
      library,
      freeplay,
      definitions,
      decks,
      opponents,
      limits,
      sets,
    ] = await Promise.all([
      readConfig(
        storage.content,
        "duel-core",
        isDuelCoreConfig,
        controller.signal,
      ),
      readConfig(
        storage.content,
        "card-library",
        isCardLibraryConfig,
        controller.signal,
      ),
      readConfig(
        storage.content,
        "freeplay",
        isFreeplayConfig,
        controller.signal,
      ),
      readAllCards(storage.content, controller.signal),
      query(
        storage.content,
        { kind: "decks", packageId: "freeplay" },
        controller.signal,
      ),
      query(
        storage.content,
        { kind: "opponents", packageId: "freeplay" },
        controller.signal,
      ),
      query(
        storage.content,
        { kind: "limits", packageId: "freeplay" },
        controller.signal,
      ),
      query(
        storage.content,
        { kind: "sets", packageId: "card-library" },
        controller.signal,
      ),
    ]);
    throwIfAborted(controller.signal);

    const cards = createCards(definitions);
    const ruleset = deckRuleset(freeplay, packages, limits);
    validatePublishedDecks(decks, cards, ruleset);
    validateFreeplayReferences(freeplay, decks, opponents);
    const images = createSqliteCardImageSource(storage.content);
    try {
      const snapshotId = runtimeSnapshotId(packages);
      const libraryIdentity = packageById(packages, "card-library");
      const presentationDecks = Object.freeze(
        decks.map(({ id, name, main, extra, side }) =>
          Object.freeze({
            id,
            name,
            ...cloneCardLists({ main, extra, side }),
          }),
        ),
      );
      const presentationOpponents = Object.freeze(
        opponents.map(({ id, name, line, deckId }) =>
          Object.freeze({ id, name, line, deckId }),
        ),
      );
      const defaults = Object.freeze({ ...freeplay.defaults });
      const presentation = Object.freeze({
        snapshotId,
        catalogRevision: `${libraryIdentity.version}:${libraryIdentity.sha256}`,
        cards: cardsDeckCatalog(cards),
        decks: presentationDecks,
        opponents: presentationOpponents,
        defaults,
      });
      const starter = decks.find(
        ({ id }) => id === freeplay.defaults.starterDeckId,
      )!;
      const editor = Object.freeze({
        ruleset,
        cards,
        images,
        starter: Object.freeze({
          name: starter.name,
          cards: cloneCardLists(starter),
        }),
      });
      const battle = createSqliteBattleRuntimeSource({
        content: storage.content,
        packages,
        cards,
        core,
        library,
        ruleset: {
          id: freeplay.rulesetId,
          revisionPackageId: "freeplay",
          limits,
        },
      });
      let closed = false;
      const loaded: LoadedFreeplayInputs = Object.freeze({
        collectionSets: Object.freeze(sets),
        users,
        cards,
        images,
        battle,
        presentation,
        editor,
        close() {
          if (closed) return;
          closed = true;
          images.close();
        },
      });
      throwIfAborted(controller.signal);
      return loaded;
    } catch (error) {
      images.close();
      throw error;
    }
  } catch (error) {
    controller.abort();
    throwIfAborted(signal);
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

function requiredPackages(
  packages: readonly ActivePackage[],
): readonly ActivePackage[] {
  return Object.freeze(
    (["duel-core", "card-library", "freeplay"] as const)
      .map((packageId) => packageById(packages, packageId))
      .sort((left, right) => left.packageId.localeCompare(right.packageId)),
  );
}

function packageById(
  packages: readonly ActivePackage[],
  packageId: "duel-core" | "card-library" | "freeplay",
): ActivePackage {
  const matches = packages.filter((active) => active.packageId === packageId);
  if (matches.length !== 1) throw new Error("APP_REQUIRED_INPUT_FAILED");
  return matches[0]!;
}

function deckRuleset(
  config: FreeplayConfig,
  packages: readonly ActivePackage[],
  limits: QueryMap["limits"],
): PinnedDeckRuleset {
  const freeplay = packageById(packages, "freeplay");
  return Object.freeze({
    id: config.rulesetId,
    revision: `${freeplay.version}:${freeplay.sha256}`,
    quantityByCode: new Map(
      limits.map(([code, quantity]) => [code, quantity] as const),
    ),
  });
}

function validateFreeplayReferences(
  config: FreeplayConfig,
  decks: QueryMap["decks"],
  opponents: QueryMap["opponents"],
): void {
  const deckIds = new Set(decks.map(({ id }) => id));
  const opponentIds = new Set(opponents.map(({ id }) => id));
  if (
    !deckIds.has(config.defaults.starterDeckId) ||
    !opponentIds.has(config.defaults.opponentId) ||
    opponents.some(({ deckId }) => !deckIds.has(deckId))
  )
    throw new Error("DECK_RELEASE_INVALID");
}

function isFreeplayConfig(value: QueryMap["config"]): value is FreeplayConfig {
  const record = object(value);
  const defaults = object(record.defaults);
  return (
    typeof record.title === "string" &&
    record.title.length > 0 &&
    typeof record.rulesetId === "string" &&
    record.rulesetId.length > 0 &&
    typeof defaults.starterDeckId === "string" &&
    defaults.starterDeckId.length > 0 &&
    typeof defaults.opponentId === "string" &&
    defaults.opponentId.length > 0
  );
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
