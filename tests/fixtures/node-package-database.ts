import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  PACKAGE_SCHEMA_SQL,
  CARD_LIBRARY_SCHEMA_SQL,
  CHAPTER_SCHEMA_SQL,
  FREEPLAY_SCHEMA_SQL,
} from "../../src/storage/schema/sql.ts";
import type { ActivePackage } from "../../src/storage/contracts/storage-client.ts";
import type {
  PackageManifest,
  PackageId,
} from "../../src/storage/contracts/package.ts";
import type {
  RuntimeDatabase,
  RuntimeFileStore,
} from "../../src/storage/runtime/runtime-ports.ts";
import type { SqliteValue } from "../../src/storage/schema/package-database.ts";

export function nodePackageDatabase(
  root: string,
  packageId: PackageId,
  predecessor: PackageId | null,
) {
  const file = `${root}/${packageId}.sqlite`;
  const database = new DatabaseSync(file);
  database.exec(
    PACKAGE_SCHEMA_SQL +
      (packageId === "card-library"
        ? CARD_LIBRARY_SCHEMA_SQL
        : packageId === "freeplay"
          ? FREEPLAY_SCHEMA_SQL
          : packageId === "chapter-01"
            ? CHAPTER_SCHEMA_SQL
            : ""),
  );
  const manifest: PackageManifest = {
    packageId,
    packageType:
      packageId === "chapter-01"
        ? "chapter"
        : (packageId as "duel-core" | "card-library" | "freeplay"),
    version: "1.0.0",
    schemaVersion: 1,
    dependencies:
      predecessor === null
        ? []
        : [{ packageId: predecessor, requirement: "exact", version: "1.0.0" }],
    createdAt: "2026-09-24T00:00:00.000Z",
  };
  database
    .prepare("INSERT INTO package_manifest VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      packageId,
      manifest.packageType,
      manifest.version,
      1,
      JSON.stringify(manifest.dependencies),
      manifest.createdAt,
    );
  database.exec("INSERT INTO package_meta VALUES ('config', '{}')");
  return { database, file, manifest };
}
export type NodePackageDatabase = ReturnType<typeof nodePackageDatabase>;
export function insertFixtureAsset(
  database: DatabaseSync,
  path: string,
  mime: string,
  bytes: Uint8Array,
) {
  database
    .prepare("INSERT INTO assets VALUES (?, ?, ?, ?, ?)")
    .run(
      path,
      mime,
      bytes.byteLength,
      createHash("sha256").update(bytes).digest("hex"),
      bytes,
    );
}
export function readOnlyPackageFiles(
  fixtures: ReadonlyMap<PackageId, NodePackageDatabase>,
): RuntimeFileStore {
  const forbidden = (): never => {
    throw new Error("Read-only domain query fixture");
  };
  return {
    reserveMinimumCapacity: forbidden,
    importDatabase: forbidden,
    exportDatabase: forbidden,
    has: forbidden,
    list: forbidden,
    unlink: forbidden,
    close: forbidden,
    openDatabase(key) {
      const fixture = fixtures.get(key as ActivePackage["packageId"]);
      if (!fixture) throw new Error(`Unknown fixture package: ${key}`);
      const database = new DatabaseSync(fixture.file, { readOnly: true });
      const reader: RuntimeDatabase = {
        all: (sql, parameters = []) =>
          database.prepare(sql).all(...parameters) as ReadonlyArray<
            Record<string, SqliteValue>
          >,
        each: (sql, parameters, callback) => {
          for (const row of database.prepare(sql).iterate(...parameters))
            if (callback(row as Record<string, SqliteValue>) === false) break;
        },
        exec: forbidden,
        run: forbidden,
        exportBytes: forbidden,
        close: () => database.close(),
      };
      return reader;
    },
  };
}
