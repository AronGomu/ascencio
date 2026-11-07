import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type {
  StorageFailure,
  StorageResult,
} from "../../src/storage/contracts/package.ts";
import type {
  BackupPreview,
  UserMutation,
  UserNamespace,
  UserRecord,
} from "../../src/storage/contracts/user-data.ts";
import {
  isQuota,
  userDatabaseFailure,
} from "../../src/storage/schema/package-database-failure.ts";
import { validateUserRecordPayload } from "../../src/storage/schema/user-record-validation.ts";
import type {
  RuntimeDatabase,
  RuntimeFileStore,
} from "../../src/storage/runtime/runtime-ports.ts";
import {
  isUserNamespace,
  preflightUserDataDatabase,
  payloadRevisionMatches,
  USER_DATA_MAX_BACKUP_BYTES,
  validateUserDataDatabase,
  validUserKey,
  type ValidatedUserRow,
} from "./legacy-user-data-validation.ts";

const FILE_CHUNK_BYTES = 1024 * 1024;
const SQLITE_MIME = "application/vnd.sqlite3";

export type UserDataRuntimeOptions = (
  { readonly database: RuntimeDatabase } | { readonly failure: StorageFailure }
) & {
  readonly files: RuntimeFileStore;
  readonly randomId: () => string;
  readonly fault?: ((point: string) => void) | undefined;
};

interface StagedBackup {
  readonly key: string;
  readonly digest: string;
  readonly currentRevision: number;
}

interface PreparedPut {
  readonly mutation: Extract<UserMutation, { readonly kind: "put" }>;
  readonly payloadJson: string;
}

type PreparedMutation =
  PreparedPut | Extract<UserMutation, { readonly kind: "delete" }>;

export class UserDataRuntime {
  readonly #database: RuntimeDatabase | null;
  readonly #failure: StorageResult<never>;
  readonly #files: RuntimeFileStore;
  readonly #randomId: () => string;
  readonly #fault: (point: string) => void;
  readonly #staged = new Map<string, StagedBackup>();
  readonly #issuedTokens = new Set<string>();
  readonly #ownedStaging = new Set<string>();
  #operationSequence = 0;
  #closed = false;
  #tail: Promise<void> = Promise.resolve();

  constructor(options: UserDataRuntimeOptions) {
    this.#database = "database" in options ? options.database : null;
    this.#failure =
      "failure" in options
        ? { kind: "failed", error: options.failure }
        : unavailable();
    this.#files = options.files;
    this.#randomId = options.randomId;
    this.#fault = options.fault ?? (() => {});
  }

  async reconcileStagedBackups(): Promise<
    StorageResult<{ readonly removedFiles: number }>
  > {
    return await this.#serialize(async () => {
      if (this.#closed) return unavailable();
      let removedFiles = 0;
      try {
        for (const key of this.#files.list()) {
          if (!/^\/user-backups\/[A-Za-z0-9_-]+\.staged$/.test(key)) continue;
          if (this.#files.unlink(key)) removedFiles += 1;
        }
        const remaining = this.#files
          .list()
          .filter((key) =>
            /^\/user-backups\/[A-Za-z0-9_-]+\.staged$/.test(key),
          );
        return remaining.length === 0
          ? { kind: "ok", value: { removedFiles } }
          : unavailable();
      } catch {
        return unavailable();
      }
    });
  }

  async readUser(
    namespace: UserNamespace,
    key: string,
  ): Promise<StorageResult<UserRecord | null>> {
    if (this.#closed) return unavailable();
    if (this.#database === null) return this.#failure;
    if (!isUserNamespace(namespace) || !validUserKey(key)) return invalid();
    try {
      const preflight = preflightUserDataDatabase(this.#database);
      if (preflight.kind === "failed") return preflight;
      const rows = this.#database.all(
        "SELECT namespace, record_key, revision, payload_json FROM user_records WHERE namespace=? AND record_key=?",
        [namespace, key],
      );
      if (rows.length === 0) return { kind: "ok", value: null };
      if (rows.length !== 1) return invalid();
      const parsed = parseUserRow(rows[0]!);
      return parsed.kind === "failed"
        ? parsed
        : { kind: "ok", value: publicRecord(parsed.value) };
    } catch (error) {
      return userDatabaseFailure(error);
    }
  }

  async listUser(
    namespace: UserNamespace,
  ): Promise<StorageResult<readonly UserRecord[]>> {
    if (this.#closed) return unavailable();
    if (this.#database === null) return this.#failure;
    if (!isUserNamespace(namespace)) return invalid();
    try {
      const preflight = preflightUserDataDatabase(this.#database);
      if (preflight.kind === "failed") return preflight;
      const result: UserRecord[] = [];
      let failure: StorageResult<never> | null = null;
      this.#database.each(
        "SELECT namespace, record_key, revision, payload_json FROM user_records WHERE namespace=? ORDER BY record_key",
        [namespace],
        (row) => {
          const parsed = parseUserRow(row);
          if (parsed.kind === "failed") {
            failure = parsed;
            return false;
          }
          result.push(publicRecord(parsed.value));
        },
      );
      return failure ?? { kind: "ok", value: result };
    } catch (error) {
      return userDatabaseFailure(error);
    }
  }

  async writeUser(
    mutations: readonly UserMutation[],
  ): Promise<StorageResult<readonly UserRecord[]>> {
    if (this.#database === null) return this.#failure;
    const prepared = prepareMutations(mutations);
    if (prepared.kind === "failed") return prepared;
    return await this.#serialize(async () => {
      if (this.#closed) return unavailable();
      if (this.#database === null) return this.#failure;
      if (prepared.value.length === 0) return { kind: "ok", value: [] };
      try {
        this.#database.exec("BEGIN IMMEDIATE");
        const globalRevision = readGlobalRevision(this.#database);
        if (globalRevision === Number.MAX_SAFE_INTEGER) throw invalidError();
        const returned: UserRecord[] = [];
        let mutationIndex = 0;
        for (const item of prepared.value) {
          const mutation = "mutation" in item ? item.mutation : item;
          const current = currentRowRevision(
            this.#database,
            mutation.namespace,
            mutation.key,
          );
          if (
            (mutation.kind === "put" &&
              ((mutation.expectedRevision === null && current !== null) ||
                (mutation.expectedRevision !== null &&
                  current !== mutation.expectedRevision))) ||
            (mutation.kind === "delete" &&
              current !== mutation.expectedRevision)
          )
            throw conflictError();
          if (mutation.kind === "delete") {
            const changed = this.#database.run(
              "DELETE FROM user_records WHERE namespace=? AND record_key=? AND revision=?",
              [mutation.namespace, mutation.key, mutation.expectedRevision],
            );
            if (changed.changes !== 1) throw conflictError();
          } else {
            const nextRevision = current === null ? 1 : current + 1;
            if (
              !Number.isSafeInteger(nextRevision) ||
              !payloadRevisionMatches(
                mutation.namespace,
                mutation.payload,
                nextRevision,
              )
            )
              throw invalidError();
            this.#database.run(
              `INSERT INTO user_records (namespace, record_key, revision, payload_json)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(namespace, record_key) DO UPDATE SET
                 revision=excluded.revision,
                 payload_json=excluded.payload_json`,
              [
                mutation.namespace,
                mutation.key,
                nextRevision,
                (item as PreparedPut).payloadJson,
              ],
            );
            returned.push({
              namespace: mutation.namespace,
              key: mutation.key,
              revision: nextRevision,
              payload: mutation.payload,
            });
          }
          if (mutationIndex++ === 0) this.#fault("write-after-first");
        }
        const changed = this.#database.run(
          "UPDATE user_data_meta SET revision=revision+1 WHERE singleton=1 AND revision=?",
          [globalRevision],
        );
        if (changed.changes !== 1) throw conflictError();
        this.#database.exec("COMMIT");
        return { kind: "ok", value: returned };
      } catch (error) {
        tryRollback(this.#database);
        return operationFailure(error);
      }
    });
  }

  async exportUserData(): Promise<StorageResult<Blob>> {
    return await this.#serialize(async () => {
      if (this.#closed) return unavailable();
      if (this.#database === null) return this.#failure;
      const validated = validateUserDataDatabase(this.#database);
      if (validated.kind === "failed") return validated;
      try {
        const bytes = this.#database.exportBytes();
        if (bytes.byteLength > USER_DATA_MAX_BACKUP_BYTES) return tooLarge();
        if (!validSqliteBytes(bytes)) return invalid();
        return {
          kind: "ok",
          value: new File([Uint8Array.from(bytes)], "user-data.sqlite", {
            type: SQLITE_MIME,
          }),
        };
      } catch (error) {
        return operationFailure(error);
      }
    });
  }

  async inspectUserDataBackup(
    file: File,
  ): Promise<StorageResult<BackupPreview>> {
    return await this.#serialize(async () => {
      if (this.#closed) return unavailable();
      if (this.#database === null) return this.#failure;
      if (!this.#expireStaged()) return unavailable();
      if (file.size > USER_DATA_MAX_BACKUP_BYTES) return tooLarge();
      const header = await inspectUserHeader(file);
      if (header.kind === "failed") return header;
      const id = this.#nextId();
      const key = `/user-backups/${id}.staged`;
      this.#ownedStaging.add(key);
      let keep = false;
      try {
        await this.#files.reserveMinimumCapacity(this.#files.list().length + 3);
        let offset = 0;
        const bytes = await this.#files.importDatabase(key, async () => {
          if (offset >= file.size) return undefined;
          const end = Math.min(file.size, offset + FILE_CHUNK_BYTES);
          const chunk = new Uint8Array(
            await file.slice(offset, end).arrayBuffer(),
          );
          offset = end;
          return chunk;
        });
        if (bytes !== file.size || offset !== file.size) return invalid();
        let database: RuntimeDatabase | null = null;
        try {
          database = this.#files.openDatabase(key);
          const validated = validateUserDataDatabase(database);
          if (validated.kind === "failed") return validated;
          const snapshot = await this.#files.exportDatabase(key);
          if (snapshot.byteLength > USER_DATA_MAX_BACKUP_BYTES)
            return tooLarge();
          const currentRevision = readGlobalRevision(this.#database);
          const token = this.#uniqueToken();
          this.#staged.set(token, {
            key,
            digest: bytesToHex(sha256(snapshot)),
            currentRevision,
          });
          keep = true;
          return {
            kind: "ok",
            value: {
              token,
              currentRevision,
              counts: validated.value.counts,
            },
          };
        } finally {
          database?.close();
        }
      } catch (error) {
        return operationFailure(error);
      } finally {
        if (!keep) this.#unlinkOwned(key);
      }
    });
  }

  async restoreUserData(
    token: string,
    expectedRevision: number,
    confirmed: true,
  ): Promise<StorageResult<{ readonly revision: number }>> {
    return await this.#serialize(async () => {
      if (this.#closed) return unavailable();
      if (this.#database === null) return this.#failure;
      const staged = this.#staged.get(token);
      if (staged === undefined) return conflict();
      this.#staged.delete(token);
      try {
        if (confirmed !== true) return confirmationRequired();
        if (
          !Number.isSafeInteger(expectedRevision) ||
          expectedRevision < 0 ||
          staged.currentRevision !== expectedRevision ||
          readGlobalRevision(this.#database) !== expectedRevision
        )
          return conflict();
        let backup: RuntimeDatabase | null = null;
        let validated: ReturnType<typeof validateUserDataDatabase>;
        try {
          backup = this.#files.openDatabase(staged.key);
          validated = validateUserDataDatabase(backup);
        } finally {
          backup?.close();
        }
        if (validated.kind === "failed") return validated;
        const snapshot = await this.#files.exportDatabase(staged.key);
        if (snapshot.byteLength > USER_DATA_MAX_BACKUP_BYTES) return tooLarge();
        if (bytesToHex(sha256(snapshot)) !== staged.digest) return invalid();
        const livePreflight = preflightUserDataDatabase(this.#database);
        if (livePreflight.kind === "failed") return livePreflight;
        if (expectedRevision === Number.MAX_SAFE_INTEGER) return invalid();
        if (!this.#unlinkOwned(staged.key)) return unavailable();
        try {
          this.#database.exec("BEGIN IMMEDIATE");
          if (readGlobalRevision(this.#database) !== expectedRevision)
            throw conflictError();
          this.#database.run("DELETE FROM user_records");
          this.#fault("restore-after-delete");
          for (const row of validated.value.rows)
            this.#database.run(
              "INSERT INTO user_records (namespace, record_key, revision, payload_json) VALUES (?, ?, ?, ?)",
              [row.namespace, row.key, row.revision, row.payloadJson],
            );
          this.#fault("restore-before-meta");
          const changed = this.#database.run(
            "UPDATE user_data_meta SET revision=revision+1 WHERE singleton=1 AND revision=?",
            [expectedRevision],
          );
          if (changed.changes !== 1) throw conflictError();
          this.#database.exec("COMMIT");
          return { kind: "ok", value: { revision: expectedRevision + 1 } };
        } catch (error) {
          tryRollback(this.#database);
          return operationFailure(error);
        }
      } catch (error) {
        return operationFailure(error);
      } finally {
        this.#unlinkOwned(staged.key);
      }
    });
  }

  async close(): Promise<void> {
    await this.#serialize(async () => {
      if (this.#closed) return;
      this.#closed = true;
      const stagedClean = this.#expireStaged();
      this.#database?.close();
      if (!stagedClean) throw new Error("user backup cleanup failed");
    });
  }

  #nextId(): string {
    const base = this.#randomId();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(base)) throw new Error("invalid id");
    let candidate = base;
    const names = new Set(this.#files.list());
    while (names.has(`/user-backups/${candidate}.staged`))
      candidate = `${base}-${++this.#operationSequence}`;
    return candidate;
  }

  #uniqueToken(): string {
    const base = this.#randomId();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(base)) throw new Error("invalid token");
    let token = base;
    while (this.#issuedTokens.has(token))
      token = `${base}-${++this.#operationSequence}`;
    this.#issuedTokens.add(token);
    return token;
  }

  #expireStaged(): boolean {
    for (const key of this.#ownedStaging) this.#unlinkOwned(key);
    this.#staged.clear();
    return this.#ownedStaging.size === 0;
  }

  #unlinkOwned(key: string): boolean {
    if (!/^\/user-backups\/[A-Za-z0-9_-]+\.staged$/.test(key)) return false;
    try {
      if (this.#files.unlink(key) || !this.#files.has(key))
        this.#ownedStaging.delete(key);
    } catch {
      // Retain ownership so next inspect/close retries this exact staging key.
    }
    return !this.#ownedStaging.has(key);
  }

  async #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#tail;
    let release!: () => void;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

function prepareMutations(
  input: readonly UserMutation[],
): StorageResult<readonly PreparedMutation[]> {
  let mutations: readonly UserMutation[];
  try {
    mutations = structuredClone(input);
  } catch {
    return invalid();
  }
  if (!Array.isArray(mutations)) return invalid();
  const seen = new Set<string>();
  const prepared: PreparedMutation[] = [];
  for (const mutation of mutations) {
    if (
      typeof mutation !== "object" ||
      mutation === null ||
      !isUserNamespace(mutation.namespace) ||
      !validUserKey(mutation.key)
    )
      return invalid();
    const identity = `${mutation.namespace}\0${mutation.key}`;
    if (seen.has(identity)) return invalid();
    seen.add(identity);
    if (mutation.kind === "delete") {
      if (!positiveRevision(mutation.expectedRevision)) return invalid();
      prepared.push({ ...mutation });
      continue;
    }
    if (mutation.kind !== "put") return invalid();
    if (
      mutation.expectedRevision !== null &&
      !positiveRevision(mutation.expectedRevision)
    )
      return invalid();
    const payload = validateUserRecordPayload(
      mutation.namespace,
      mutation.key,
      mutation.payload,
    );
    if (payload.kind === "failed") return payload;
    let payloadJson: string;
    try {
      payloadJson = JSON.stringify(mutation.payload);
    } catch {
      return invalid();
    }
    prepared.push({
      mutation: { ...mutation, payload: JSON.parse(payloadJson) as unknown },
      payloadJson,
    });
  }
  return { kind: "ok", value: prepared };
}

function parseUserRow(
  row: Readonly<Record<string, unknown>>,
): StorageResult<ValidatedUserRow> {
  if (
    !isUserNamespace(row.namespace) ||
    !validUserKey(row.record_key) ||
    !positiveRevision(row.revision) ||
    typeof row.payload_json !== "string"
  )
    return invalid();
  let payload: unknown;
  try {
    payload = JSON.parse(row.payload_json) as unknown;
  } catch {
    return invalid();
  }
  const validation = validateUserRecordPayload(
    row.namespace,
    row.record_key,
    payload,
  );
  if (validation.kind === "failed") return validation;
  if (!payloadRevisionMatches(row.namespace, payload, row.revision))
    return invalid();
  return {
    kind: "ok",
    value: {
      namespace: row.namespace,
      key: row.record_key,
      revision: row.revision,
      payload,
      payloadJson: row.payload_json,
    },
  };
}

function publicRecord(row: ValidatedUserRow): UserRecord {
  return {
    namespace: row.namespace,
    key: row.key,
    revision: row.revision,
    payload: row.payload,
  };
}

function currentRowRevision(
  database: RuntimeDatabase,
  namespace: UserNamespace,
  key: string,
): number | null {
  const rows = database.all(
    "SELECT revision FROM user_records WHERE namespace=? AND record_key=?",
    [namespace, key],
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !positiveRevision(rows[0]?.revision))
    throw invalidError();
  return rows[0].revision;
}

function readGlobalRevision(database: RuntimeDatabase): number {
  const rows = database.all(
    "SELECT revision FROM user_data_meta WHERE singleton=1",
  );
  const revision = rows.length === 1 ? rows[0]?.revision : undefined;
  if (
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw invalidError();
  return revision;
}

async function inspectUserHeader(file: File): Promise<StorageResult<void>> {
  if (file.size < 512 || file.size % 512 !== 0) return invalid();
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, 100).arrayBuffer());
  } catch (error) {
    return operationFailure(error);
  }
  return validSqliteBytes(bytes) ? { kind: "ok", value: undefined } : invalid();
}

function validSqliteBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 100) return false;
  const magic = "SQLite format 3\0";
  for (let index = 0; index < magic.length; index += 1)
    if (bytes[index] !== magic.charCodeAt(index)) return false;
  if (bytes[18] !== 1 || bytes[19] !== 1) return false;
  const encodedPageSize = ((bytes[16] ?? 0) << 8) | (bytes[17] ?? 0);
  const pageSize = encodedPageSize === 1 ? 65_536 : encodedPageSize;
  return (
    pageSize >= 512 && pageSize <= 65_536 && (pageSize & (pageSize - 1)) === 0
  );
}

function operationFailure<T>(error: unknown): StorageResult<T> {
  if (isConflict(error)) return conflict();
  if (isInvalid(error)) return invalid();
  if (isQuota(error)) return failed("STORAGE_QUOTA_EXCEEDED");
  const native = error as {
    resultCode?: unknown;
    errcode?: unknown;
    code?: unknown;
  } | null;
  const resultCode = native?.resultCode ?? native?.errcode;
  const primary =
    typeof resultCode === "number" ? resultCode & 0xff : undefined;
  if (primary === 11 || primary === 26 || native?.code === "SQLITE_CORRUPT")
    return invalid();
  if (primary !== undefined || typeof native?.code === "string")
    return userDatabaseFailure(error) as StorageResult<T>;
  return unavailable();
}

function positiveRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
function conflictError(): Error {
  return Object.assign(new Error("conflict"), { name: "StorageConflict" });
}
function invalidError(): Error {
  return Object.assign(new Error("invalid user data"), {
    name: "UserDataInvalid",
  });
}
function isConflict(value: unknown): boolean {
  return value instanceof Error && value.name === "StorageConflict";
}
function isInvalid(value: unknown): boolean {
  return value instanceof Error && value.name === "UserDataInvalid";
}
function tryRollback(database: RuntimeDatabase): void {
  try {
    database.exec("ROLLBACK");
  } catch {
    // Failed BEGIN or completed COMMIT leaves no transaction to roll back.
  }
}
function failed<T>(code: StorageFailure["code"]): StorageResult<T> {
  return { kind: "failed", error: { code } };
}
function invalid<T>(): StorageResult<T> {
  return failed("USER_DATA_INVALID");
}
function tooLarge<T>(): StorageResult<T> {
  return failed("USER_DATA_TOO_LARGE");
}
function conflict<T>(): StorageResult<T> {
  return failed("STORAGE_CONFLICT");
}
function confirmationRequired<T>(): StorageResult<T> {
  return failed("RESTORE_CONFIRMATION_REQUIRED");
}
function unavailable<T>(): StorageResult<T> {
  return failed("STORAGE_UNAVAILABLE");
}
