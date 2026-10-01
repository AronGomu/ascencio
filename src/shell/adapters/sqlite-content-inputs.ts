import { validateCommerce } from "../../modules/index.ts";
import type { CardDefinition } from "../../cards/index.ts";
import type {
  CardLibraryConfig,
  ContentQueries,
  DuelCoreConfig,
  PackageId,
  QueryMap,
  StorageFailure,
} from "../../storage/index.ts";

const PAGE_SIZE = 500;

export async function readAllCards(
  content: ContentQueries,
  signal: AbortSignal,
): Promise<readonly CardDefinition[]> {
  const cards: CardDefinition[] = [];
  let afterCode = 0;
  while (true) {
    throwIfAborted(signal);
    const page = await query(
      content,
      { kind: "cards", locale: "en", afterCode, limit: PAGE_SIZE },
      signal,
    );
    if (page.length === 0) break;
    for (const card of page) {
      if (card.code <= afterCode) throw new Error("CARDS_INVALID_DEFINITION");
      afterCode = card.code;
      cards.push(card);
    }
    if (page.length < PAGE_SIZE) break;
  }
  return Object.freeze(cards);
}

export async function readConfig<T extends QueryMap["config"]>(
  content: ContentQueries,
  packageId: PackageId,
  validate: (value: QueryMap["config"]) => value is T,
  signal: AbortSignal,
): Promise<T> {
  const value = await query(content, { kind: "config", packageId }, signal);
  if (!validate(value)) throw new Error("APP_REQUIRED_INPUT_FAILED");
  return value;
}

export async function query<Q extends Parameters<ContentQueries["query"]>[0]>(
  content: ContentQueries,
  request: Q,
  signal: AbortSignal,
): Promise<QueryMap[Q["kind"]]> {
  const result = await content.query(request, signal);
  if (result.kind === "failed") throw storageError(result.error);
  throwIfAborted(signal);
  return result.value;
}

export function isDuelCoreConfig(
  value: QueryMap["config"],
): value is DuelCoreConfig {
  const record = object(value);
  const strings = object(record.strings);
  return (
    Array.isArray(record.coreVersion) &&
    record.coreVersion.length === 2 &&
    record.coreVersion[0] === 11 &&
    record.coreVersion[1] === 0 &&
    record.wasmPath === "engine/ocgcore.sync.wasm" &&
    record.vendorManifestPath === "engine/vendor-manifest.json" &&
    ["system", "victory", "counter", "setname"].every((group) =>
      stringRecord(strings[group]),
    ) &&
    Object.keys(object(strings.system)).length > 0 &&
    Object.keys(object(strings.victory)).length > 0
  );
}

export function isCardLibraryConfig(
  value: QueryMap["config"],
): value is CardLibraryConfig {
  const record = object(value);
  const revisions = object(record.revisions);
  const required = object(record.requiredScripts);
  return (
    record.defaultLocale === "en" &&
    Array.isArray(record.locales) &&
    record.locales.every((locale) => typeof locale === "string") &&
    typeof revisions.babelCdb === "string" &&
    typeof revisions.cardScripts === "string" &&
    Array.isArray(required.cards) &&
    required.cards.every((name) => typeof name === "string") &&
    Array.isArray(required.globals) &&
    required.globals.every((name) => typeof name === "string") &&
    (record.commerce === undefined || validateCommerce(record.commerce))
  );
}

function stringRecord(value: unknown): boolean {
  const record = object(value);
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(record).every((entry) => typeof entry === "string")
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
