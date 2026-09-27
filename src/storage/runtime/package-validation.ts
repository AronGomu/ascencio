import { packageDatabaseFailure } from "../schema/package-database-failure.ts";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { PackageManifest, StorageResult } from "../contracts/package.ts";
import type {
  CardLibraryConfig,
  PackageConfig,
} from "../contracts/package-payloads.ts";
import { validatePackageDatabase } from "../schema/package-database.ts";
import type { RuntimeDatabase } from "./runtime-ports.ts";

export const FILE_CHUNK_BYTES = 1024 * 1024;
export const MEDIA_BLOB_CAP = 64 * 1024 * 1024;
export const ENGINE_BLOB_CAP = 16 * 1024 * 1024;

export interface ValidatedRuntimePackage {
  readonly manifest: PackageManifest;
  readonly config: PackageConfig;
}

export function inspectSqliteHeader(file: File): Promise<StorageResult<void>> {
  return inspectHeader(file);
}

async function inspectHeader(file: File): Promise<StorageResult<void>> {
  if (file.size < 512 || file.size % 512 !== 0)
    return failed("PACKAGE_INVALID");
  const header = new Uint8Array(await file.slice(0, 100).arrayBuffer());
  const magic = "SQLite format 3\0";
  for (let index = 0; index < magic.length; index += 1)
    if (header[index] !== magic.charCodeAt(index))
      return failed("PACKAGE_INVALID");
  if (header[18] !== 1 || header[19] !== 1) return failed("PACKAGE_INVALID");
  const encodedPageSize = ((header[16] ?? 0) << 8) | (header[17] ?? 0);
  const pageSize = encodedPageSize === 1 ? 65_536 : encodedPageSize;
  if (pageSize < 512 || pageSize > 65_536 || (pageSize & (pageSize - 1)) !== 0)
    return failed("PACKAGE_INVALID");
  return { kind: "ok", value: undefined };
}

export function validateRuntimePackage(
  database: RuntimeDatabase,
): StorageResult<ValidatedRuntimePackage> {
  const base = validatePackageDatabase(database);
  if (base.kind === "failed") return base;
  const packageId = base.value.manifest.packageId;
  try {
    const assetPaths = new Set<string>();
    let assetFailure = false;
    const cap =
      base.value.manifest.packageType === "duel-core"
        ? ENGINE_BLOB_CAP
        : MEDIA_BLOB_CAP;
    // Finish the metadata pass before any row can materialize a hostile BLOB.
    database.each(
      "SELECT path, byte_length, length(data) AS actual_length FROM assets ORDER BY path",
      [],
      (row) => {
        if (
          typeof row.path !== "string" ||
          !validAssetLengths(row.byte_length, row.actual_length, cap)
        ) {
          assetFailure = true;
          return false;
        }
      },
    );
    if (assetFailure) return integrity(packageId);
    database.each(
      "SELECT path, byte_length, sha256, data FROM assets ORDER BY path",
      [],
      (row) => {
        if (
          typeof row.path !== "string" ||
          typeof row.byte_length !== "number" ||
          !(row.data instanceof Uint8Array) ||
          typeof row.sha256 !== "string"
        ) {
          assetFailure = true;
          return false;
        }
        if (
          row.byte_length > cap ||
          row.data.byteLength !== row.byte_length ||
          bytesToHex(sha256(row.data)) !== row.sha256
        ) {
          assetFailure = true;
          return false;
        }
        assetPaths.add(row.path);
      },
    );
    if (assetFailure) return integrity(packageId);
    if (base.value.manifest.packageType === "duel-core") {
      for (const required of [
        "engine/ocgcore.sync.wasm",
        "engine/vendor-manifest.json",
      ])
        if (!assetPaths.has(required)) return incomplete(packageId, required);
    }
    if (base.value.manifest.packageType === "card-library") {
      const config = base.value.config as CardLibraryConfig;
      const cards = database.all(
        "SELECT code, definition_json FROM cards ORDER BY code",
      );
      const codes = new Set(cards.map((row) => row.code));
      const textKeys = new Set(
        database
          .all(
            "SELECT card_code, locale FROM card_texts ORDER BY card_code, locale",
          )
          .map((row) => `${row.card_code}:${row.locale}`),
      );
      for (const row of cards) {
        const card = JSON.parse(String(row.definition_json)) as {
          readonly alias: number;
        };
        if (card.alias !== 0 && !codes.has(card.alias))
          return incomplete(packageId);
        for (const locale of config.locales)
          if (!textKeys.has(`${row.code}:${locale}`))
            return incomplete(packageId);
      }
      const names = new Set<string>();
      let scriptFailure = false;
      database.each(
        "SELECT name, source, sha256 FROM scripts ORDER BY name",
        [],
        (row) => {
          if (
            typeof row.name !== "string" ||
            typeof row.source !== "string" ||
            typeof row.sha256 !== "string" ||
            bytesToHex(sha256(new TextEncoder().encode(row.source))) !==
              row.sha256
          ) {
            scriptFailure = true;
            return false;
          }
          names.add(row.name);
        },
      );
      if (scriptFailure) return integrity(packageId);
      for (const required of [
        ...config.requiredScripts.cards,
        ...config.requiredScripts.globals,
      ])
        if (!names.has(required)) return incomplete(packageId, required);
    }
    if (
      base.value.manifest.packageType === "freeplay" ||
      base.value.manifest.packageType === "chapter"
    ) {
      const config = base.value.config as {
        readonly defaults: {
          readonly starterDeckId: string;
          readonly opponentId: string;
        };
        readonly storyContentId?: string | null;
      };
      if (
        !exists(database, "SELECT 1 AS present FROM decks WHERE id=?", [
          config.defaults.starterDeckId,
        ]) ||
        !exists(database, "SELECT 1 AS present FROM opponents WHERE id=?", [
          config.defaults.opponentId,
        ])
      )
        return incomplete(packageId);
      if (
        base.value.manifest.packageType === "chapter" &&
        config.storyContentId !== null &&
        !exists(
          database,
          "SELECT 1 AS present FROM story_documents WHERE id=?",
          [config.storyContentId ?? ""],
        )
      )
        return incomplete(packageId);
    }
    return {
      kind: "ok",
      value: { manifest: base.value.manifest, config: base.value.config },
    };
  } catch (error) {
    return packageDatabaseFailure(error, packageId);
  }
}

export function validAssetLengths(
  declared: unknown,
  actual: unknown,
  cap: number,
): boolean {
  return (
    typeof declared === "number" &&
    Number.isSafeInteger(declared) &&
    declared >= 0 &&
    declared <= cap &&
    actual === declared
  );
}

function exists(
  database: RuntimeDatabase,
  sql: string,
  parameters: readonly (string | number)[],
): boolean {
  return database.all(sql, parameters).length === 1;
}

function failed(code: "PACKAGE_INVALID"): StorageResult<never> {
  return { kind: "failed", error: { code } };
}
function integrity(
  packageId: PackageManifest["packageId"],
): StorageResult<never> {
  return {
    kind: "failed",
    error: { code: "PACKAGE_INTEGRITY_FAILED", packageId },
  };
}
function incomplete(
  packageId: PackageManifest["packageId"],
  path?: string,
): StorageResult<never> {
  return {
    kind: "failed",
    error: {
      code: "PACKAGE_SOURCE_INCOMPLETE",
      packageId,
      ...(path ? { path } : {}),
    },
  };
}
