import type { ContentQuery } from "../../../src/storage/contracts/storage-client.ts";
import type { PackageId } from "../../../src/storage/contracts/package.ts";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import type { SqliteValue } from "../../../src/storage/schema/index.ts";
import type {
  RuntimeDatabase,
  RuntimeFileStore,
  RuntimeRunResult,
} from "../../../src/storage/runtime/runtime-ports.ts";
import {
  createRegistryFixture,
  createImportablePackageFixture,
  insertAsset,
  FIXTURE_ROOT,
  sqliteReader,
} from "./sqlite-fixtures.ts";

export function databaseAdapter(database: DatabaseSync): RuntimeDatabase {
  return {
    ...sqliteReader(database),
    each(sql, parameters, callback) {
      for (const row of database
        .prepare(sql)
        .iterate(...parameters) as Iterable<
        Readonly<Record<string, SqliteValue>>
      >)
        if (callback(row) === false) break;
    },
    exec(sql) {
      database.exec(sql);
    },
    run(sql, parameters = []): RuntimeRunResult {
      const result = database.prepare(sql).run(...parameters);
      return { changes: Number(result.changes) };
    },
    exportBytes() {
      return (database as unknown as { serialize(): Uint8Array }).serialize();
    },
    close() {
      database.close();
    },
  };
}

export interface NodeFileStore extends RuntimeFileStore {
  readonly maxChunkBytes: number;
  readonly importedKeys: readonly string[];
  readonly root: string;
  failDelete: boolean;
  failQuotaDuringImport: boolean;
}

export function createNodeFileStore(): NodeFileStore {
  const root = path.join(FIXTURE_ROOT, `runtime-${crypto.randomUUID()}`);
  mkdirSync(root, { recursive: true });
  let maxChunkBytes = 0;
  const importedKeys: string[] = [];
  const filePath = (key: string): string =>
    path.join(root, encodeURIComponent(key));
  return {
    root,
    importedKeys,
    failDelete: false,
    failQuotaDuringImport: false,
    get maxChunkBytes() {
      return maxChunkBytes;
    },
    async reserveMinimumCapacity() {},
    async importDatabase(key, nextChunk) {
      importedKeys.push(key);
      const destination = filePath(key);
      const fd = openSync(destination, "w");
      let bytes = 0;
      try {
        while (true) {
          const chunk = await nextChunk();
          if (chunk === undefined) break;
          if (this.failQuotaDuringImport)
            throw Object.assign(new Error("injected quota"), {
              name: "QuotaExceededError",
            });
          maxChunkBytes = Math.max(maxChunkBytes, chunk.byteLength);
          writeSync(fd, chunk);
          bytes += chunk.byteLength;
        }
      } finally {
        closeSync(fd);
      }
      return bytes;
    },
    openDatabase(key) {
      return databaseAdapter(
        new DatabaseSync(filePath(key), { readOnly: true }),
      );
    },
    async exportDatabase(key) {
      return new Uint8Array(readFileSync(filePath(key)));
    },
    has(key) {
      return existsSync(filePath(key));
    },
    list() {
      return readdirSync(root)
        .map((name) => decodeURIComponent(name))
        .sort();
    },
    unlink(key) {
      if (this.failDelete) throw new Error("injected delete failure");
      if (!existsSync(filePath(key))) return false;
      unlinkSync(filePath(key));
      return true;
    },
    close() {},
  };
}

export function createRuntimeFixture() {
  const registryFixture = createRegistryFixture();
  const files = createNodeFileStore();
  return {
    registryFixture,
    registry: databaseAdapter(registryFixture.database),
    files,
  };
}

export function fixtureFile(source: string, name = "untrusted.sqlite"): File {
  return new File([readFileSync(source)], name, {
    type: "application/vnd.sqlite3",
  });
}

export function breakLibraryClosure(
  database: DatabaseSync,
  defect: "alias" | "locale" | "text",
): void {
  if (defect === "alias")
    database.exec(
      "UPDATE cards SET definition_json=json_set(definition_json, '$.alias', 999999999)",
    );
  else if (defect === "locale")
    database.exec(
      `UPDATE package_meta SET value_json=json_set(value_json, '$.locales', json('["en","fr"]'))`,
    );
  else
    database.exec("DELETE FROM card_texts WHERE card_code=1 AND locale='en'");
}

export const packageOpenFailures = [
  {
    label: "native corruption",
    error: Object.assign(new Error("injected SQLITE_CORRUPT"), {
      resultCode: 11,
    }),
    code: "PACKAGE_INTEGRITY_FAILED",
  },
  {
    label: "native not-a-database",
    error: Object.assign(new Error("injected SQLITE_NOTADB"), { errcode: 26 }),
    code: "PACKAGE_INTEGRITY_FAILED",
  },
  {
    label: "quota",
    error: Object.assign(new Error("injected full"), { resultCode: 13 }),
    code: "STORAGE_QUOTA_EXCEEDED",
  },
  {
    label: "I/O",
    error: Object.assign(new Error("injected I/O"), {
      resultCode: 10 | (1 << 8),
    }),
    code: "STORAGE_UNAVAILABLE",
  },
  {
    label: "open I/O",
    error: Object.assign(new Error("injected cantopen"), { errcode: 14 }),
    code: "STORAGE_UNAVAILABLE",
  },
] as const;

export function trackAssetReads(
  database: RuntimeDatabase,
  dataReads: string[],
): RuntimeDatabase {
  const observe = (sql: string): void => {
    if (
      /\bFROM assets\b/i.test(sql) &&
      /\bdata\b/i.test(sql.replace(/length\(data\)/gi, "actual_length"))
    ) {
      dataReads.push(sql);
      throw new Error("test blocked BLOB materialization");
    }
  };
  return {
    ...database,
    all(sql, parameters) {
      observe(sql);
      return database.all(sql, parameters);
    },
    each(sql, parameters, callback) {
      observe(sql);
      database.each(sql, parameters, callback);
    },
  };
}

export function completeStackFiles(): File[] {
  return (["duel-core", "card-library", "freeplay", "chapter-01"] as const).map(
    (id) => {
      const fixture = createImportablePackageFixture(id);
      if (id === "card-library")
        insertAsset(
          fixture.database,
          "cards/full/1.jpg",
          "image/jpeg",
          new Uint8Array([1, 2, 3]),
        );
      fixture.database.close();
      return fixtureFile(fixture.file);
    },
  );
}

export const crossPackageDefects = [
  ...(["freeplay", "chapter-01"] as const).flatMap((packageId) => [
    ...(["main", "extra", "side"] as const).map((pile) => ({
      label: `${packageId} deck ${pile}`,
      packageId,
      sql: `UPDATE decks SET cards_json=json_set(cards_json, '$.${pile}', json('[999999999]'))`,
    })),
    {
      label: `${packageId} limit`,
      packageId,
      sql: `INSERT INTO ${packageId === "freeplay" ? "freeplay" : "chapter"}_card_limits VALUES (999999999, 0)`,
    },
  ]),
  {
    label: "chapter set",
    packageId: "chapter-01" as const,
    sql: `UPDATE package_meta SET value_json=json_set(value_json, '$.setIds', json('["missing-set"]'))`,
  },
];

export function activeFileKey(
  fixture: ReturnType<typeof createRuntimeFixture>,
  packageId: PackageId,
): string {
  const row = fixture.registryFixture.database
    .prepare("SELECT file_key FROM installed_packages WHERE package_id=?")
    .get(packageId) as { file_key: string };
  return row.file_key;
}

export function breakCrossPackageReference(
  fixture: ReturnType<typeof createRuntimeFixture>,
  defect: (typeof crossPackageDefects)[number],
): void {
  const database = new DatabaseSync(
    path.join(
      fixture.files.root,
      encodeURIComponent(activeFileKey(fixture, defect.packageId)),
    ),
  );
  database.exec(defect.sql);
  database.close();
}

export const queryFailureCases = [
  {
    label: "cards",
    packageId: "card-library",
    request: { kind: "cards", locale: "en", afterCode: 0, limit: 1 },
    sql: /FROM cards c/,
    optional: false,
  },
  {
    label: "config",
    packageId: "duel-core",
    request: { kind: "config", packageId: "duel-core" },
    sql: /SELECT value_json FROM package_meta/,
    optional: false,
  },
  {
    label: "optional asset metadata",
    packageId: "card-library",
    request: {
      kind: "asset",
      packageId: "card-library",
      path: "card-back.jpg",
    },
    sql: /SELECT byte_length, length\(data\)/,
    optional: true,
  },
  {
    label: "optional asset BLOB",
    packageId: "card-library",
    request: {
      kind: "asset",
      packageId: "card-library",
      path: "cards/full/1.jpg",
    },
    sql: /SELECT mime, byte_length, sha256, data/,
    optional: true,
  },
  {
    label: "set-image",
    packageId: "card-library",
    request: { kind: "set-image", setId: "fixture-set" },
    sql: /SELECT metadata_json FROM sets/,
    optional: true,
  },
  ...(["metadata", "BLOB"] as const).map((phase) => ({
    label: `required asset ${phase}`,
    packageId: "duel-core" as const,
    request: {
      kind: "asset" as const,
      packageId: "duel-core" as const,
      path: "engine/ocgcore.sync.wasm",
    },
    sql:
      phase === "metadata"
        ? /SELECT byte_length, length\(data\)/
        : /SELECT mime, byte_length, sha256, data/,
    optional: false,
  })),
] as const satisfies readonly {
  label: string;
  packageId: PackageId;
  request: ContentQuery;
  sql: RegExp;
  optional: boolean;
}[];

export function injectQueryFailure(
  files: NodeFileStore,
  key: string,
  phase: "open" | "query",
  sqlPattern: RegExp,
  error: Error,
): () => number {
  const open = files.openDatabase.bind(files);
  let opens = 0;
  let hits = 0;
  files.openDatabase = (fileKey) => {
    const target = fileKey === key && ++opens === 2;
    if (target && phase === "open") {
      hits += 1;
      throw error;
    }
    const database = open(fileKey);
    if (!target) return database;
    return {
      ...database,
      all(sql, parameters) {
        if (sqlPattern.test(sql)) {
          hits += 1;
          throw error;
        }
        return database.all(sql, parameters);
      },
    };
  };
  return () => hits;
}

export const validationFailureSql = [
  "PRAGMA trusted_schema=OFF",
  "PRAGMA integrity_check",
  "SELECT path, byte_length, sha256, data FROM assets ORDER BY path",
];

export function injectValidationFailure(
  files: NodeFileStore,
  failingSql: string,
  error: Error,
): () => number {
  const open = files.openDatabase.bind(files);
  let hits = 0;
  files.openDatabase = (key) => {
    const database = open(key);
    const check = (sql: string): void => {
      if (sql === failingSql) {
        hits += 1;
        throw error;
      }
    };
    return {
      ...database,
      all(sql, parameters) {
        check(sql);
        return database.all(sql, parameters);
      },
      each(sql, parameters, callback) {
        check(sql);
        database.each(sql, parameters, callback);
      },
    };
  };
  return () => hits;
}
