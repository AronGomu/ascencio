import { USER_DATA_SCHEMA_SQL } from "./legacy-user-schema.ts";
import type { StorageResult } from "../../src/storage/contracts/package.ts";
import type {
  UserNamespace,
  UserRecord,
} from "../../src/storage/contracts/user-data.ts";
import {
  USER_DATA_MAX_PAYLOAD_BYTES,
  validateUserRecordPayload,
} from "../../src/storage/schema/user-record-validation.ts";
import { userDatabaseFailure } from "../../src/storage/schema/package-database-failure.ts";
import type { RuntimeDatabase } from "../../src/storage/runtime/runtime-ports.ts";

export const USER_DATA_MAX_BACKUP_BYTES = 256 * 1024 * 1024;
export const USER_NAMESPACES = [
  "decks",
  "deck-meta",
  "deck-autosaves",
  "story",
  "preferences",
  "story-read-log",
] as const satisfies readonly UserNamespace[];

export interface ValidatedUserRow extends UserRecord {
  readonly payloadJson: string;
}

export interface ValidatedUserDatabase {
  readonly revision: number;
  readonly rows: readonly ValidatedUserRow[];
  readonly counts: Readonly<Record<UserNamespace, number>>;
}

export function validateUserDataDatabase(
  database: RuntimeDatabase,
): StorageResult<ValidatedUserDatabase> {
  try {
    const preflight = preflightUserDataDatabase(database);
    if (preflight.kind === "failed") return preflight;

    const version = database.all("PRAGMA user_version");
    const journal = database.all("PRAGMA journal_mode");
    if (
      version.length !== 1 ||
      version[0]?.user_version !== 1 ||
      journal.length !== 1 ||
      journal[0]?.journal_mode !== "delete"
    )
      return invalid();
    const integrity = database.all("PRAGMA integrity_check");
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok")
      return invalid();
    const meta = database.all(
      "SELECT singleton, format, schema_version, revision FROM user_data_meta",
    );
    if (
      meta.length !== 1 ||
      meta[0]?.singleton !== 1 ||
      meta[0]?.format !== "ascencio-user-data" ||
      meta[0]?.schema_version !== 1 ||
      !safeCount(meta[0]?.revision)
    )
      return invalid();

    const rows: ValidatedUserRow[] = [];
    const counts = emptyUserCounts();
    let failure: StorageResult<never> | null = null;
    database.each(
      "SELECT namespace, record_key, revision, payload_json FROM user_records ORDER BY namespace, record_key",
      [],
      (row) => {
        if (
          !isUserNamespace(row.namespace) ||
          typeof row.record_key !== "string" ||
          typeof row.payload_json !== "string" ||
          !positiveRevision(row.revision)
        ) {
          failure = invalid();
          return false;
        }
        if (
          new TextEncoder().encode(row.payload_json).byteLength >
          USER_DATA_MAX_PAYLOAD_BYTES
        ) {
          failure = tooLarge();
          return false;
        }
        let payload: unknown;
        try {
          payload = JSON.parse(row.payload_json) as unknown;
        } catch {
          failure = invalid();
          return false;
        }
        const payloadResult = validateUserRecordPayload(
          row.namespace,
          row.record_key,
          payload,
        );
        if (payloadResult.kind === "failed") {
          failure = payloadResult;
          return false;
        }
        if (!payloadRevisionMatches(row.namespace, payload, row.revision)) {
          failure = invalid();
          return false;
        }
        rows.push({
          namespace: row.namespace,
          key: row.record_key,
          revision: row.revision,
          payload,
          payloadJson: row.payload_json,
        });
        counts[row.namespace] += 1;
      },
    );
    if (failure !== null) return failure;
    return {
      kind: "ok",
      value: { revision: meta[0].revision, rows, counts },
    };
  } catch (error) {
    return userDatabaseFailure(error);
  }
}

/** Schema first: never evaluate untrusted row expressions before the allowlist. */
export function preflightUserDataDatabase(
  database: RuntimeDatabase,
): StorageResult<void> {
  try {
    const objects = database.all(
      "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name",
    );
    if (!exactUserSchema(objects)) return invalid();
    const pages = database.all("PRAGMA page_count");
    const sizes = database.all("PRAGMA page_size");
    const pageCount = pages[0]?.page_count;
    const pageSize = sizes[0]?.page_size;
    if (
      pages.length !== 1 ||
      sizes.length !== 1 ||
      !safeCount(pageCount) ||
      !safeCount(pageSize) ||
      pageSize < 512 ||
      pageSize > 65536 ||
      (pageSize & (pageSize - 1)) !== 0
    )
      return invalid();
    // Division avoids overflowing the safe-integer product.
    if (pageCount > Math.floor(USER_DATA_MAX_BACKUP_BYTES / pageSize))
      return tooLarge();
    let failure: StorageResult<never> | null = null;
    database.each(
      "SELECT length(CAST(payload_json AS BLOB)) AS payload_bytes FROM user_records",
      [],
      (row) => {
        if (!safeCount(row.payload_bytes)) failure = invalid();
        else if (row.payload_bytes > USER_DATA_MAX_PAYLOAD_BYTES)
          failure = tooLarge();
        if (failure !== null) return false;
      },
    );
    return failure ?? { kind: "ok", value: undefined };
  } catch (error) {
    return userDatabaseFailure(error);
  }
}

export function emptyUserCounts(): Record<UserNamespace, number> {
  return {
    decks: 0,
    "deck-meta": 0,
    "deck-autosaves": 0,
    story: 0,
    preferences: 0,
    "story-read-log": 0,
  };
}

export function isUserNamespace(value: unknown): value is UserNamespace {
  return (
    typeof value === "string" &&
    (USER_NAMESPACES as readonly string[]).includes(value)
  );
}

export function validUserKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !value.includes("\0")
  );
}

export function payloadRevisionMatches(
  namespace: UserNamespace,
  payload: unknown,
  revision: number,
): boolean {
  if (namespace === "decks")
    return (
      typeof payload === "object" &&
      payload !== null &&
      "deck" in payload &&
      typeof payload.deck === "object" &&
      payload.deck !== null &&
      "revision" in payload.deck &&
      payload.deck.revision === revision
    );
  if (namespace === "story")
    return (
      typeof payload === "object" &&
      payload !== null &&
      "revision" in payload &&
      payload.revision === revision
    );
  return true;
}

function exactUserSchema(
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): boolean {
  const expected = new Map<
    string,
    {
      readonly type: string;
      readonly table: string;
      readonly sql: string | null;
    }
  >();
  for (const sql of USER_DATA_SCHEMA_SQL.split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.startsWith("CREATE TABLE"))) {
    const name = /^CREATE TABLE ([a-z_]+)/.exec(sql)?.[1];
    if (!name) return false;
    expected.set(name, { type: "table", table: name, sql });
  }
  expected.set("sqlite_autoindex_user_records_1", {
    type: "index",
    table: "user_records",
    sql: null,
  });
  return (
    rows.length === expected.size &&
    rows.every((row) => {
      const object =
        typeof row.name === "string" ? expected.get(row.name) : undefined;
      return (
        object !== undefined &&
        row.type === object.type &&
        row.tbl_name === object.table &&
        row.sql === object.sql
      );
    })
  );
}

function safeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function positiveRevision(value: unknown): value is number {
  return safeCount(value) && value >= 1;
}
function invalid(): StorageResult<never> {
  return { kind: "failed", error: { code: "USER_DATA_INVALID" } };
}
function tooLarge(): StorageResult<never> {
  return { kind: "failed", error: { code: "USER_DATA_TOO_LARGE" } };
}
