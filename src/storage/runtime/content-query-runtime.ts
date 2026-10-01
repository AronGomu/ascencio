import { packageDatabaseFailure } from "../schema/package-database-failure.ts";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type {
  ActivePackage,
  ContentQuery,
  MediaWarning,
  PackageStack,
  QueryMap,
} from "../contracts/storage-client.ts";
import type {
  PackageId,
  StorageFailure,
  StorageResult,
} from "../contracts/package.ts";
import { validAssetPath } from "../schema/package-database.ts";
import {
  ENGINE_BLOB_CAP,
  MEDIA_BLOB_CAP,
  validAssetLengths,
} from "./package-validation.ts";
import type { RuntimeDatabase, RuntimeFileStore } from "./runtime-ports.ts";

export function queryContent<Q extends ContentQuery>(
  request: Q,
  stack: PackageStack,
  signal: AbortSignal,
  files: RuntimeFileStore,
  mediaWarning: (warning: MediaWarning) => void,
): StorageResult<QueryMap[Q["kind"]]> {
  if (signal.aborted) return failed("OPERATION_CANCELLED");
  if (!validQuery(request)) return failed("RPC_INVALID");
  const packageId =
    request.kind === "cards" ||
    request.kind === "card-search" ||
    request.kind === "scripts" ||
    request.kind === "sets" ||
    request.kind === "set-image"
      ? "card-library"
      : request.packageId;
  const active = stack.packages.find((item) => item.packageId === packageId);
  if (!active) return failed("PACKAGE_NOT_FOUND", { packageId });
  let database: RuntimeDatabase;
  try {
    database = files.openDatabase(active.fileKey);
  } catch (error) {
    return packageDatabaseFailure(error, packageId);
  }
  try {
    return {
      kind: "ok",
      value: executeQuery(
        request.kind === "module-query" ? request.query : request,
        database,
        active,
        mediaWarning,
      ) as QueryMap[Q["kind"]],
    };
  } catch (error) {
    const result = packageDatabaseFailure(error, packageId);
    if (request.kind === "asset" && result.kind === "failed")
      return { kind: "failed", error: { ...result.error, path: request.path } };
    return result;
  } finally {
    database.close();
  }
}

function executeQuery(
  request: Exclude<ContentQuery, { kind: "module-query" }>,
  database: RuntimeDatabase,
  active: ActivePackage,
  mediaWarning: (warning: MediaWarning) => void,
): unknown {
  const packageId = active.packageId;
  switch (request.kind) {
    case "cards":
      return database
        .all(
          `SELECT c.definition_json, t.name, t.description, t.strings_json
             FROM cards c JOIN card_texts t ON t.card_code=c.code
             WHERE t.locale=? AND c.code>? ORDER BY c.code ASC LIMIT ?`,
          [request.locale, request.afterCode, request.limit],
        )
        .map((row) => {
          const definition = JSON.parse(String(row.definition_json)) as Record<
            string,
            unknown
          >;
          const code = definition.code as number;
          return {
            ...definition,
            name: row.name,
            description: row.description,
            strings: JSON.parse(String(row.strings_json)),
            images: {
              full: { code, variant: "full" },
              cropped: { code, variant: "cropped" },
            },
          };
        });
    case "card-search": {
      const prefix = normalizePrefix(request.prefix);
      return database
        .all(
          `SELECT card_code FROM card_search
             WHERE locale=? AND normalized_name LIKE ? ESCAPE '\\'
             ORDER BY normalized_name ASC, card_code ASC LIMIT ?`,
          [request.locale, `${escapeLike(prefix)}%`, request.limit],
        )
        .map((row) => row.card_code);
    }
    case "config": {
      const rows = database.all(
        "SELECT value_json FROM package_meta WHERE key='config'",
      );
      return JSON.parse(String(rows[0]?.value_json));
    }
    case "scripts":
      return database.all(
        "SELECT name, source FROM scripts WHERE name>? ORDER BY name ASC LIMIT ?",
        [request.afterName, request.limit],
      );
    case "decks":
      return database
        .all("SELECT id, name, cards_json FROM decks ORDER BY id")
        .map((row) => ({
          id: row.id,
          name: row.name,
          ...(JSON.parse(String(row.cards_json)) as object),
        }));
    case "opponents":
      return database
        .all(
          "SELECT id, name, line, deck_id, policy_id FROM opponents ORDER BY id",
        )
        .map((row) => ({
          id: row.id,
          name: row.name,
          line: row.line,
          deckId: row.deck_id,
          policyId: row.policy_id,
        }));
    case "limits": {
      const table =
        packageId === "freeplay"
          ? "freeplay_card_limits"
          : "chapter_card_limits";
      return database
        .all(`SELECT card_code, deck_limit FROM ${table} ORDER BY card_code`)
        .map((row) => [row.card_code, row.deck_limit]);
    }
    case "sets":
      return querySets(database);
    case "story": {
      const rows = database.all(
        "SELECT payload_json FROM story_documents WHERE id=?",
        [request.contentId],
      );
      return rows.length === 0
        ? null
        : JSON.parse(String(rows[0]!.payload_json));
    }
    case "asset":
      return queryAsset(database, active, request.path, mediaWarning);
    case "set-image":
      return querySetImage(request.setId, database, active, mediaWarning);
  }
}

function queryAsset(
  database: RuntimeDatabase,
  active: ActivePackage,
  path: string,
  mediaWarning: (warning: MediaWarning) => void,
): { readonly mime: string; readonly bytes: Uint8Array } | null {
  const required = requiredEnginePath(active.packageId, path);
  const cap =
    active.packageType === "duel-core" ? ENGINE_BLOB_CAP : MEDIA_BLOB_CAP;
  let rows: readonly Readonly<Record<string, unknown>>[];
  try {
    rows = database.all(
      "SELECT byte_length, length(data) AS actual_length FROM assets WHERE path=?",
      [path],
    );
  } catch (error) {
    if (required) throw error;
    return optionalMediaFailure(active, path, "unreadable", mediaWarning);
  }
  if (rows.length !== 1) {
    if (required) throw new Error("required asset missing");
    return optionalMediaFailure(active, path, "missing", mediaWarning);
  }
  if (!validAssetLengths(rows[0]!.byte_length, rows[0]!.actual_length, cap)) {
    if (required) throw new Error("required asset corrupt");
    return optionalMediaFailure(active, path, "corrupt", mediaWarning);
  }
  try {
    rows = database.all(
      "SELECT mime, byte_length, sha256, data FROM assets WHERE path=?",
      [path],
    );
  } catch (error) {
    if (required) throw error;
    return optionalMediaFailure(active, path, "unreadable", mediaWarning);
  }
  const row = rows[0];
  if (
    !row ||
    typeof row.mime !== "string" ||
    typeof row.byte_length !== "number" ||
    !(row.data instanceof Uint8Array) ||
    row.data.byteLength !== row.byte_length ||
    row.data.byteLength > cap ||
    typeof row.sha256 !== "string" ||
    bytesToHex(sha256(row.data)) !== row.sha256
  ) {
    if (required) throw new Error("required asset corrupt");
    return optionalMediaFailure(active, path, "corrupt", mediaWarning);
  }
  return { mime: row.mime, bytes: row.data };
}

function optionalMediaFailure(
  active: ActivePackage,
  path: string,
  reason: MediaWarning["reason"],
  mediaWarning: (warning: MediaWarning) => void,
): null {
  mediaWarning({ packageId: active.packageId, path, reason });
  return null;
}

function querySets(database: RuntimeDatabase): unknown[] {
  return database
    .all("SELECT id, metadata_json FROM sets ORDER BY id")
    .map((row) => {
      const metadata = JSON.parse(String(row.metadata_json)) as Record<
        string,
        unknown
      >;
      const cards = database
        .all(
          `SELECT sc.card_code, ct.name, sc.rarity, sc.printing_code,
                  sc.source_rarity, sc.source_rarity_code
           FROM set_cards sc
           JOIN card_texts ct ON ct.card_code=sc.card_code AND ct.locale='en'
           WHERE sc.set_id=?
           ORDER BY sc.card_code, sc.printing_code, sc.source_rarity, sc.source_rarity_code`,
          [String(row.id)],
        )
        .map((card) => ({
          code: card.card_code,
          name: card.name,
          rarity: card.rarity,
          printingCode: card.printing_code,
          sourceRarity: card.source_rarity,
          sourceRarityCode: card.source_rarity_code,
        }));
      return {
        id: metadata.id,
        name: metadata.name,
        releaseYear: metadata.releaseYear,
        cards,
      };
    });
}

function querySetImage(
  setId: string,
  database: RuntimeDatabase,
  active: ActivePackage,
  mediaWarning: (warning: MediaWarning) => void,
): unknown {
  try {
    const rows = database.all("SELECT metadata_json FROM sets WHERE id=?", [
      setId,
    ]);
    if (rows.length !== 1)
      return optionalMediaFailure(
        active,
        `sets/${setId}`,
        "missing",
        mediaWarning,
      );
    const metadata = JSON.parse(String(rows[0]!.metadata_json)) as {
      imageAssetPath: string | null;
    };
    if (metadata.imageAssetPath === null)
      return optionalMediaFailure(
        active,
        `sets/${setId}`,
        "missing",
        mediaWarning,
      );
    return queryAsset(database, active, metadata.imageAssetPath, mediaWarning);
  } catch {
    return optionalMediaFailure(
      active,
      `sets/${setId}`,
      "unreadable",
      mediaWarning,
    );
  }
}

function requiredEnginePath(packageId: PackageId, path: string): boolean {
  return (
    packageId === "duel-core" &&
    ["engine/ocgcore.sync.wasm", "engine/vendor-manifest.json"].includes(path)
  );
}

export function validQuery(value: unknown): value is ContentQuery {
  if (!plain(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "module-query":
      return (
        exact(value, ["kind", "packageId", "query"]) &&
        typeof value.packageId === "string" &&
        (value.packageId === "card-library" ||
          /^card-pack-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.packageId)) &&
        plain(value.query) &&
        ["cards", "scripts", "sets", "set-image"].includes(
          String(value.query.kind),
        ) &&
        validQuery(value.query)
      );
    case "cards":
      return (
        exact(value, ["kind", "locale", "afterCode", "limit"]) &&
        validLocale(value.locale) &&
        safeNonnegative(value.afterCode) &&
        integerBetween(value.limit, 1, 500)
      );
    case "card-search":
      return (
        exact(value, ["kind", "locale", "prefix", "limit"]) &&
        validLocale(value.locale) &&
        typeof value.prefix === "string" &&
        value.prefix.length <= 256 &&
        integerBetween(value.limit, 1, 100)
      );
    case "config":
      return (
        exact(value, ["kind", "packageId"]) && validPackageId(value.packageId)
      );
    case "decks":
    case "opponents":
    case "limits":
      return (
        exact(value, ["kind", "packageId"]) &&
        validPlayPackageId(value.packageId)
      );
    case "scripts":
      return (
        exact(value, ["kind", "afterName", "limit"]) &&
        typeof value.afterName === "string" &&
        value.afterName.length <= 1024 &&
        integerBetween(value.limit, 1, 500)
      );
    case "sets":
      return (
        exact(value, ["kind", "packageId"]) &&
        value.packageId === "card-library"
      );
    case "story":
      return (
        exact(value, ["kind", "packageId", "contentId"]) &&
        validChapterPackageId(value.packageId) &&
        nonemptyBounded(value.contentId, 256)
      );
    case "asset":
      return (
        exact(value, ["kind", "packageId", "path"]) &&
        validPackageId(value.packageId) &&
        validAssetPath(value.path)
      );
    case "set-image":
      return (
        exact(value, ["kind", "setId"]) && nonemptyBounded(value.setId, 256)
      );
    default:
      return false;
  }
}

function normalizePrefix(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
function validPackageId(value: unknown): value is PackageId {
  return (
    value === "duel-core" ||
    value === "card-library" ||
    (typeof value === "string" &&
      value.length <= 128 &&
      /^card-pack-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) ||
    validPlayPackageId(value)
  );
}
function validPlayPackageId(
  value: unknown,
): value is "freeplay" | `chapter-${string}` {
  return value === "freeplay" || validChapterPackageId(value);
}
function validChapterPackageId(value: unknown): value is `chapter-${string}` {
  return (
    typeof value === "string" && /^chapter-(?:0[1-9]|[1-9][0-9]+)$/.test(value)
  );
}
function validLocale(value: unknown): boolean {
  return nonemptyBounded(value, 64);
}
function nonemptyBounded(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maximum
  );
}
function safeNonnegative(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function integerBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): boolean {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
  );
}
function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
function failed<T>(
  code: StorageFailure["code"],
  details: Omit<StorageFailure, "code"> = {},
): StorageResult<T> {
  return { kind: "failed", error: { code, ...details } };
}
