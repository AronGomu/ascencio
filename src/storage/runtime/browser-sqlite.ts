import type { StorageResult } from "../contracts/package.ts";
import { userDatabaseFailure } from "../schema/package-database-failure.ts";
import sqlite3InitModule, {
  type Database,
  type SAHPoolUtil,
  type SqlValue,
} from "@sqlite.org/sqlite-wasm";
import sqliteWasmUrl from "@sqlite.org/sqlite-wasm/sqlite3.wasm?url";
import {
  CONTENT_REGISTRY_SCHEMA_SQL,
  USER_DATA_SCHEMA_SQL,
} from "../schema/sql.ts";
import type { SqliteValue } from "../schema/package-database.ts";
import type {
  RuntimeDatabase,
  RuntimeFileStore,
  RuntimeRunResult,
} from "./runtime-ports.ts";
import { validateUserDataDatabase } from "./user-data-validation.ts";

const REGISTRY_KEY = "/content-registry.sqlite";
const USER_DATA_KEY = "/user-data.sqlite";

type SqliteInit = (options: {
  readonly locateFile: (path: string) => string;
}) => ReturnType<typeof sqlite3InitModule>;

export interface BrowserSqliteRuntime {
  readonly registry: RuntimeDatabase;
  readonly userData: StorageResult<RuntimeDatabase>;
  readonly files: RuntimeFileStore;
}

export async function openBrowserSqliteRuntime(): Promise<
  StorageResult<BrowserSqliteRuntime>
> {
  let sqlite3: Awaited<ReturnType<SqliteInit>>;
  let pool: SAHPoolUtil;
  try {
    sqlite3 = await (sqlite3InitModule as SqliteInit)({
      locateFile: (file) =>
        file.endsWith("sqlite3.wasm")
          ? new URL(sqliteWasmUrl, self.location.href).href
          : file,
    });
    pool = await sqlite3.installOpfsSAHPoolVfs({
      name: "ascencio-sqlite-v1",
      directory: ".ascencio-sqlite-v1",
      clearOnInit: false,
      initialCapacity: 16,
    });
  } catch (error) {
    const failure = userDatabaseFailure(error);
    return failure.kind === "failed" &&
      failure.error.code !== "USER_DATA_INVALID"
      ? failure
      : { kind: "failed", error: { code: "SQLITE_UNAVAILABLE" } };
  }
  const names = pool.getFileNames();
  const registryExisted = names.includes(REGISTRY_KEY);
  const userDataExisted = names.includes(USER_DATA_KEY);
  const exportBytes = (database: Database): Uint8Array => {
    if (database.pointer === undefined) throw new Error("database is closed");
    return sqlite3.capi.sqlite3_js_db_export(database.pointer);
  };
  let registry: RuntimeDatabase | null = null;
  try {
    registry = databaseAdapter(
      new sqlite3.oo1.DB(REGISTRY_KEY, "c", pool.vfsName),
      exportBytes,
    );
    registry.all("PRAGMA trusted_schema=OFF");
    registry.all("PRAGMA foreign_keys=ON");
    if (!registryExisted) registry.exec(CONTENT_REGISTRY_SCHEMA_SQL);
    validateRegistryHeader(registry);
  } catch (error) {
    try {
      registry?.close();
    } finally {
      pool.pauseVfs();
    }
    const failure = userDatabaseFailure(error);
    return failure.kind === "failed" &&
      failure.error.code !== "USER_DATA_INVALID"
      ? failure
      : { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
  }
  let userDatabase: RuntimeDatabase | null = null;
  let userData: StorageResult<RuntimeDatabase>;
  try {
    userDatabase = databaseAdapter(
      new sqlite3.oo1.DB(USER_DATA_KEY, "c", pool.vfsName),
      exportBytes,
    );
    userDatabase.all("PRAGMA trusted_schema=OFF");
    userDatabase.all("PRAGMA foreign_keys=ON");
    if (!userDataExisted) userDatabase.exec(USER_DATA_SCHEMA_SQL);
    const validation = validateUserDataDatabase(userDatabase);
    userData =
      validation.kind === "failed"
        ? validation
        : { kind: "ok", value: userDatabase };
  } catch (error) {
    userData = userDatabaseFailure(error);
  }
  if (userData.kind === "failed") userDatabase?.close();
  return {
    kind: "ok",
    value: {
      registry,
      userData,
      files: fileStore(sqlite3.oo1.DB, pool, exportBytes),
    },
  };
}

function fileStore(
  DatabaseClass: typeof Database,
  pool: SAHPoolUtil,
  exportBytes: (database: Database) => Uint8Array,
): RuntimeFileStore {
  return {
    async reserveMinimumCapacity(databaseFiles) {
      await pool.reserveMinimumCapacity(databaseFiles);
    },
    async importDatabase(key, nextChunk) {
      return await pool.importDb(key, nextChunk);
    },
    openDatabase(key) {
      const db = new DatabaseClass(key, "r", pool.vfsName);
      const adapter = databaseAdapter(db, exportBytes);
      try {
        adapter.all("PRAGMA trusted_schema=OFF");
        adapter.all("PRAGMA foreign_keys=ON");
        return adapter;
      } catch (error) {
        adapter.close();
        throw error;
      }
    },
    async exportDatabase(key) {
      return await pool.exportFile(key);
    },
    has(key) {
      return pool.getFileNames().includes(key);
    },
    list() {
      return pool.getFileNames();
    },
    unlink(key) {
      return pool.unlink(key);
    },
    close() {
      pool.pauseVfs();
    },
  };
}

function databaseAdapter(
  database: Database,
  exportBytes: (database: Database) => Uint8Array,
): RuntimeDatabase {
  return {
    all(sql, parameters = []) {
      const rows: Record<string, SqlValue>[] = [];
      database.exec({
        sql,
        bind: parameters as readonly SqlValue[],
        rowMode: "object",
        resultRows: rows,
        returnValue: "resultRows",
      });
      return rows as ReadonlyArray<Readonly<Record<string, SqliteValue>>>;
    },
    each(sql, parameters, callback) {
      database.exec({
        sql,
        bind: parameters as readonly SqlValue[],
        rowMode: "object",
        callback: (row) =>
          callback(row as Readonly<Record<string, SqliteValue>>),
      });
    },
    exec(sql) {
      database.exec(sql);
    },
    run(sql, parameters = []): RuntimeRunResult {
      database.exec({ sql, bind: parameters as readonly SqlValue[] });
      const rows: SqlValue[] = [];
      database.exec({
        sql: "SELECT changes()",
        rowMode: 0,
        resultRows: rows,
        returnValue: "resultRows",
      });
      return { changes: Number(rows[0]) };
    },
    exportBytes() {
      return exportBytes(database);
    },
    close() {
      database.close();
    },
  };
}

function validateRegistryHeader(database: RuntimeDatabase): void {
  const version = database.all("PRAGMA user_version");
  const journal = database.all("PRAGMA journal_mode");
  const objects = database.all(
    "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name",
  );
  const expected = new Map<
    string,
    {
      readonly type: string;
      readonly table: string;
      readonly sql: string | null;
    }
  >();
  for (const sql of CONTENT_REGISTRY_SCHEMA_SQL.split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.startsWith("CREATE TABLE"))) {
    const name = /^CREATE TABLE ([a-z_]+)/.exec(sql)?.[1];
    if (!name) throw new Error("invalid registry schema constant");
    expected.set(name, { type: "table", table: name, sql });
  }
  for (const [name, table] of [
    ["sqlite_autoindex_import_receipts_1", "import_receipts"],
    ["sqlite_autoindex_installed_packages_1", "installed_packages"],
    ["sqlite_autoindex_installed_packages_2", "installed_packages"],
  ] as const)
    expected.set(name, { type: "index", table, sql: null });
  const exactSchema =
    objects.length === expected.size &&
    objects.every((row) => {
      const object =
        typeof row.name === "string" ? expected.get(row.name) : undefined;
      return (
        object !== undefined &&
        row.type === object.type &&
        row.tbl_name === object.table &&
        row.sql === object.sql
      );
    });
  if (
    version.length !== 1 ||
    version[0]?.user_version !== 1 ||
    journal.length !== 1 ||
    journal[0]?.journal_mode !== "delete" ||
    !exactSchema
  )
    throw new Error("invalid content registry");
  const integrity = database.all("PRAGMA integrity_check");
  if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok")
    throw new Error("invalid content registry integrity");
  const state = database.all(
    "SELECT generation FROM registry_state WHERE singleton=1",
  );
  if (
    state.length !== 1 ||
    typeof state[0]?.generation !== "number" ||
    !Number.isSafeInteger(state[0].generation) ||
    state[0].generation < 0
  )
    throw new Error("invalid content registry state");
}
