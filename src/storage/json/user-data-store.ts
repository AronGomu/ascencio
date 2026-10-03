import type { StorageCode, StorageResult } from "../contracts/package.ts";
import type {
  BackupPreview,
  RestoreUserDataResult,
  RestoreOutcomeUnknown,
  UserDataStore,
  UserMutation,
  UserNamespace,
  UserRecord,
} from "../contracts/user-data.ts";
import { validateUserRecordPayload } from "../schema/user-record-validation.ts";
import {
  emptyUserDocument,
  isUserNamespace,
  parseUserDocument,
  payloadRevisionMatches,
  safeRevision,
  USER_DATA_MAX_BYTES,
  USER_NAMESPACES,
  validUserKey,
  type UserDocument,
} from "./user-document.ts";

export interface UserJsonBackend {
  read(): Promise<string | null>;
  write(source: string, expected: string | null): Promise<StorageResult<void>>;
  close?(): Promise<void>;
}

/** Initialized once; mutations and reads use the live document, writes retain exact bytes. */
export class JsonUserDataStore implements UserDataStore {
  readonly #backend: UserJsonBackend;
  #closed = false;
  #uncertain = false;
  #initializationError: unknown;
  #state: StorageResult<{
    source: string | null;
    document: UserDocument;
  }> | null = null;
  readonly #records = new Map<string, UserRecord>();
  readonly #namespaces = new Map<UserNamespace, readonly UserRecord[]>();
  #persistedRevision = 0;
  #pending: { source: string; expected: string | null } | null = null;
  #tail: Promise<void> = Promise.resolve();
  #backup: { token: string; revision: number; document: UserDocument } | null =
    null;

  constructor(backend: UserJsonBackend) {
    this.#backend = backend;
  }
  get initializationError(): unknown {
    return this.#initializationError;
  }

  initialize(): Promise<StorageResult<void>> {
    return this.#run(async () => {
      const result = await this.#read();
      return result.kind === "failed" ? result : ok(undefined);
    });
  }

  get persistence() {
    return Object.freeze({
      acceptedRevision:
        this.#state?.kind === "ok" ? this.#state.value.document.revision : 0,
      persistedRevision: this.#persistedRevision,
      dirty: this.#pending !== null,
      uncertain: this.#uncertain,
    });
  }

  flush(): Promise<StorageResult<void>> {
    return this.#run(() => this.#flush());
  }

  async #flush(): Promise<StorageResult<void>> {
    if (!this.#pending) return ok(undefined);
    const pending = this.#pending;
    const result = await this.#backend.write(pending.source, pending.expected);
    if (result.kind === "ok") {
      this.#pending = null;
      this.#persistedRevision =
        this.#state?.kind === "ok"
          ? this.#state.value.document.revision
          : this.#persistedRevision;
    }
    return result;
  }

  readUser(
    namespace: UserNamespace,
    key: string,
  ): Promise<StorageResult<UserRecord | null>> {
    return this.#run(async () => {
      if (!isUserNamespace(namespace) || !validUserKey(key))
        return fail("USER_DATA_INVALID");
      const state = await this.#read();
      return state.kind === "failed"
        ? state
        : ok(
            structuredClone(
              this.#records.get(JSON.stringify([namespace, key])) ?? null,
            ),
          );
    });
  }

  listUser(
    namespace: UserNamespace,
  ): Promise<StorageResult<readonly UserRecord[]>> {
    return this.#run(async () => {
      if (!isUserNamespace(namespace)) return fail("USER_DATA_INVALID");
      const state = await this.#read();
      return state.kind === "failed"
        ? state
        : ok(structuredClone(this.#namespaces.get(namespace) ?? []));
    });
  }

  writeUser(
    mutations: readonly UserMutation[],
  ): Promise<StorageResult<readonly UserRecord[]>> {
    // Capture input before queued work so caller mutation cannot change a pending save.
    let captured: readonly UserMutation[];
    try {
      captured = structuredClone(mutations);
    } catch {
      return Promise.resolve(fail("USER_DATA_INVALID"));
    }
    return this.#run(async () => {
      if (!Array.isArray(captured)) return fail("USER_DATA_INVALID");
      const pending = await this.#flush();
      if (pending.kind === "failed") return pending;
      const state = await this.#read();
      if (state.kind === "failed") return state;
      if (captured.length === 0) return ok([]);
      const records = new Map(
        state.value.document.records.map((row) => [
          JSON.stringify([row.namespace, row.key]),
          row,
        ]),
      );
      const changed: UserRecord[] = [];
      const seen = new Set<string>();
      for (const mutation of captured) {
        if (
          !mutation ||
          !isUserNamespace(mutation.namespace) ||
          !validUserKey(mutation.key)
        )
          return fail("USER_DATA_INVALID");
        const identity = JSON.stringify([mutation.namespace, mutation.key]);
        if (seen.has(identity)) return fail("USER_DATA_INVALID");
        seen.add(identity);
        const previous = records.get(identity);
        if (
          mutation.expectedRevision !== null &&
          (!safeRevision(mutation.expectedRevision) ||
            mutation.expectedRevision === 0)
        )
          return fail("USER_DATA_INVALID");
        if ((previous?.revision ?? null) !== mutation.expectedRevision)
          return fail("STORAGE_CONFLICT");
        if (mutation.kind === "delete") {
          if (!previous) return fail("STORAGE_CONFLICT");
          records.delete(identity);
        } else if (mutation.kind === "put") {
          const revision = (previous?.revision ?? 0) + 1;
          if (!safeRevision(revision)) return fail("USER_DATA_INVALID");
          const validated = validateUserRecordPayload(
            mutation.namespace,
            mutation.key,
            mutation.payload,
          );
          if (validated.kind === "failed") return validated;
          if (
            !payloadRevisionMatches(
              mutation.namespace,
              mutation.payload,
              revision,
            )
          )
            return fail("USER_DATA_INVALID");
          const record = {
            namespace: mutation.namespace,
            key: mutation.key,
            revision,
            payload: mutation.payload,
          };
          records.set(identity, record);
          changed.push(record);
        } else return fail("USER_DATA_INVALID");
      }
      const revision = state.value.document.revision + 1;
      if (!safeRevision(revision)) return fail("USER_DATA_INVALID");
      const committed = await this.#commit(
        { ...state.value.document, revision, records: [...records.values()] },
        state.value.source,
      );
      return committed.kind === "failed" ? committed : ok(changed);
    });
  }

  exportUserData(): Promise<StorageResult<Blob>> {
    return this.#run(async () => {
      const state = await this.#read();
      return state.kind === "failed"
        ? state
        : ok(
            new File([JSON.stringify(state.value.document)], "user-data.json", {
              type: "application/json",
            }),
          );
    });
  }

  inspectUserDataBackup(file: File): Promise<StorageResult<BackupPreview>> {
    return this.#run(async () => {
      this.#backup = null;
      if (file.size > USER_DATA_MAX_BYTES) return fail("USER_DATA_TOO_LARGE");
      const bytes = await file.arrayBuffer();
      let source: string;
      try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return fail("USER_DATA_INVALID");
      }
      const parsed = parseUserDocument(source);
      if (parsed.kind === "failed") return parsed;
      const live = await this.#read();
      if (live.kind === "failed") return live;
      const counts = Object.fromEntries(
        USER_NAMESPACES.map((namespace) => [namespace, 0]),
      ) as Record<UserNamespace, number>;
      for (const record of parsed.value.records) counts[record.namespace] += 1;
      const token = crypto.randomUUID();
      this.#backup = {
        token,
        revision: live.value.document.revision,
        document: parsed.value,
      };
      return ok({
        token,
        currentRevision: live.value.document.revision,
        counts,
      });
    });
  }

  restoreUserData(
    token: string,
    expectedRevision: number,
    confirmed: true,
  ): Promise<RestoreUserDataResult> {
    return this.#run(async () => {
      const staged = this.#backup;
      this.#backup = null;
      if (confirmed !== true) return fail("RESTORE_CONFIRMATION_REQUIRED");
      if (
        !staged ||
        staged.token !== token ||
        staged.revision !== expectedRevision ||
        !safeRevision(expectedRevision)
      )
        return fail("STORAGE_CONFLICT");
      const live = await this.#read();
      if (live.kind === "failed") return live;
      if (live.value.document.revision !== expectedRevision)
        return fail("STORAGE_CONFLICT");
      const revision = expectedRevision + 1;
      if (!safeRevision(revision)) return fail("USER_DATA_INVALID");
      const result = await this.#commit(
        { ...staged.document, revision },
        live.value.source,
        false,
      );
      return result.kind === "failed" ? result : ok({ revision });
    }, true);
  }

  async close(): Promise<void> {
    // Stop admission immediately, then drain work already accepted.
    this.#closed = true;
    await this.#tail;
    if (this.#uncertain) {
      this.#backup = null;
      await this.#backend.close?.();
      return;
    }
    try {
      const flushed = await this.#flush();
      if (flushed.kind === "failed") throw new Error(flushed.error.code);
    } finally {
      this.#backup = null;
      await this.#backend.close?.();
    }
  }

  #index(document: UserDocument): void {
    this.#records.clear();
    this.#namespaces.clear();
    const namespaces = new Map<UserNamespace, UserRecord[]>();
    for (const row of document.records) {
      this.#records.set(JSON.stringify([row.namespace, row.key]), row);
      const records = namespaces.get(row.namespace) ?? [];
      records.push(row);
      namespaces.set(row.namespace, records);
    }
    for (const [namespace, rows] of namespaces)
      this.#namespaces.set(
        namespace,
        rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
      );
  }

  async #read(): Promise<
    StorageResult<{ source: string | null; document: UserDocument }>
  > {
    if (this.#state !== null) return this.#state;
    const source = await this.#backend.read();
    const parsed =
      source === null ? ok(emptyUserDocument()) : parseUserDocument(source);
    this.#state =
      parsed.kind === "failed"
        ? parsed
        : ok({ source, document: parsed.value });
    if (parsed.kind === "ok") {
      this.#persistedRevision = parsed.value.revision;
      this.#index(parsed.value);
    }
    return this.#state;
  }

  async #commit(
    document: UserDocument,
    expected: string | null,
    publishBeforeAcknowledgement = true,
  ): Promise<StorageResult<void>> {
    const source = JSON.stringify(document);
    const validated = parseUserDocument(source);
    if (validated.kind === "failed") return validated;
    if (publishBeforeAcknowledgement) {
      this.#state = ok({ source, document: validated.value });
      this.#index(validated.value);
      this.#pending = { source, expected };
      return this.#flush();
    }
    const result = await this.#backend.write(source, expected);
    if (result.kind === "ok") {
      this.#state = ok({ source, document: validated.value });
      this.#index(validated.value);
      this.#persistedRevision = document.revision;
    }
    return result;
  }

  #run<T>(
    operation: () => Promise<StorageResult<T>>,
    restoring?: false,
  ): Promise<StorageResult<T>>;
  #run<T>(
    operation: () => Promise<StorageResult<T>>,
    restoring: true,
  ): Promise<StorageResult<T> | RestoreOutcomeUnknown>;
  #run<T>(
    operation: () => Promise<StorageResult<T>>,
    restoring = false,
  ): Promise<StorageResult<T> | RestoreOutcomeUnknown> {
    if (this.#closed) return Promise.resolve(fail("STORAGE_UNAVAILABLE"));
    const result = this.#tail
      .then(() => (this.#uncertain ? fail("STORAGE_UNAVAILABLE") : operation()))
      .catch((error: unknown) => {
        if (this.#state === null) this.#initializationError = error;
        if (
          error instanceof Error &&
          error.name === "UserWriteOutcomeUnknown"
        ) {
          this.#uncertain = true;
          if (restoring) return { kind: "restore-outcome-unknown" as const };
        }
        return fail(
          error instanceof Error && error.name === "QuotaExceededError"
            ? "STORAGE_QUOTA_EXCEEDED"
            : "STORAGE_UNAVAILABLE",
        );
      });
    this.#tail = result.then(() => {});
    return result;
  }
}

function ok<T>(value: T): StorageResult<T> {
  return { kind: "ok", value };
}
function fail(code: StorageCode): StorageResult<never> {
  return { kind: "failed", error: { code } };
}
