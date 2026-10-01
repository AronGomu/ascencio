import { packageDatabaseFailure } from "../schema/package-database-failure.ts";
import type { ActivePackage } from "../contracts/storage-client.ts";
import type { PackageId, StorageResult } from "../contracts/package.ts";
import type { RuntimeFileStore } from "../runtime/runtime-ports.ts";

export interface CatalogInventory {
  readonly cards: ReadonlySet<number>;
  readonly sets: ReadonlySet<string>;
}
/** Cross-module identity collisions are rejected before registry activation. */
export function validateModuleCatalogs(
  packages: readonly Pick<
    ActivePackage,
    "packageId" | "packageType" | "fileKey"
  >[],
  files: RuntimeFileStore,
): StorageResult<ReadonlyMap<PackageId, CatalogInventory>> {
  const identities = new Map<string, string>();
  const catalogs = new Map<PackageId, CatalogInventory>();
  for (const item of packages) {
    if (item.packageType !== "card-library") continue;
    let db: ReturnType<RuntimeFileStore["openDatabase"]> | null = null;
    try {
      db = files.openDatabase(item.fileKey);
      const cards = new Set<number>();
      const sets = new Set<string>();
      for (const [sql, key, payload] of [
        [
          "SELECT code, definition_json FROM cards",
          (row: Record<string, unknown>) => `card:${row.code}`,
          (row: Record<string, unknown>) => String(row.definition_json),
        ],
        [
          "SELECT card_code, locale, name, description, strings_json FROM card_texts",
          (row: Record<string, unknown>) =>
            `text:${row.card_code}:${row.locale}`,
          (row: Record<string, unknown>) =>
            JSON.stringify([row.name, row.description, row.strings_json]),
        ],
        [
          "SELECT name, source FROM scripts",
          (row: Record<string, unknown>) => `script:${row.name}`,
          (row: Record<string, unknown>) => String(row.source),
        ],
      ] as const) {
        for (const row of db.all(sql)) {
          const id = key(row);
          const value = payload(row);
          if (identities.has(id) && identities.get(id) !== value)
            return {
              kind: "failed",
              error: {
                code: "PACKAGE_IDENTITY_CONFLICT",
                packageId: item.packageId,
              },
            };
          identities.set(id, value);
          if (id.startsWith("card:")) cards.add(Number(row.code));
        }
      }
      for (const row of db.all("SELECT id FROM sets")) {
        const id = String(row.id);
        if (identities.has(`set:${id}`))
          return {
            kind: "failed",
            error: {
              code: "PACKAGE_IDENTITY_CONFLICT",
              packageId: item.packageId,
            },
          };
        identities.set(`set:${id}`, "");
        sets.add(id);
      }
      catalogs.set(item.packageId, { cards, sets });
    } catch (error) {
      return packageDatabaseFailure(error, item.packageId);
    } finally {
      db?.close();
    }
  }
  return { kind: "ok", value: catalogs };
}
