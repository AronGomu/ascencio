import type {
  ImportProgress,
  MediaWarning,
} from "../contracts/storage-client.ts";
import type { RpcArgs, RpcResponse } from "../contracts/rpc.ts";
import type { StorageResult } from "../contracts/package.ts";

import type { RestoreOutcomeUnknown } from "../contracts/user-data.ts";

interface RequestOptions {
  readonly progress?: (value: ImportProgress) => void;
  readonly onRequestId?: (id: string) => void;
}

export interface WorkerTransport extends EventTarget {
  postMessage(value: unknown): void;
  terminate(): void;
}
interface PendingRequest {
  readonly resolve: (
    value: StorageResult<unknown> | RestoreOutcomeUnknown,
  ) => void;
  readonly method: keyof RpcArgs;
  dispatched: boolean;
  readonly progress: ((value: ImportProgress) => void) | undefined;
}

export class StorageRpcClient {
  readonly #worker: WorkerTransport;
  readonly #pending = new Map<string, PendingRequest>();
  readonly #warnings = new Set<(value: MediaWarning) => void>();
  #nextId = 0;
  #failed = false;

  constructor(worker: WorkerTransport) {
    this.#worker = worker;
    worker.addEventListener("message", this.#onMessage);
    worker.addEventListener("error", this.#onTransportFailure);
    worker.addEventListener("messageerror", this.#onTransportFailure);
  }

  request(
    method: "restoreUserData",
    args: RpcArgs["restoreUserData"],
    options?: RequestOptions,
  ): Promise<StorageResult<unknown> | RestoreOutcomeUnknown>;
  request<M extends Exclude<keyof RpcArgs, "restoreUserData">>(
    method: M,
    args: RpcArgs[M],
    options?: RequestOptions,
  ): Promise<StorageResult<unknown>>;
  request(
    method: keyof RpcArgs,
    args: RpcArgs[keyof RpcArgs],
    options: RequestOptions = {},
  ): Promise<StorageResult<unknown> | RestoreOutcomeUnknown> {
    if (this.#failed)
      return Promise.resolve({
        kind: "failed",
        error: { code: "STORAGE_UNAVAILABLE" },
      });
    const id = `storage-${++this.#nextId}`;
    options.onRequestId?.(id);
    return new Promise<StorageResult<unknown> | RestoreOutcomeUnknown>(
      (resolve) => {
        const pending: PendingRequest = {
          resolve,
          method,
          dispatched: false,
          progress: options.progress,
        };
        this.#pending.set(id, pending);
        try {
          this.#worker.postMessage({ id, method, args });
          // A synchronous clone/dispatch throw means this request was never sent.
          // Native Worker events cannot run until postMessage has returned.
          pending.dispatched = true;
        } catch {
          this.#transportFailure();
        }
      },
    );
  }

  subscribeMediaWarnings(listener: (value: MediaWarning) => void): () => void {
    this.#warnings.add(listener);
    return () => this.#warnings.delete(listener);
  }

  closeTransport(): void {
    this.#transportFailure();
  }

  readonly #onMessage = (event: Event): void => {
    const value = (event as MessageEvent<unknown>).data;
    if (!isRpcResponse(value)) {
      this.#transportFailure();
      return;
    }
    const pending = this.#pending.get(value.id);
    if (!pending) return;
    if (value.kind === "progress") {
      pending.progress?.(value.progress);
      return;
    }
    if (value.kind === "media-warning") {
      for (const listener of this.#warnings) listener(value.warning);
      return;
    }
    this.#pending.delete(value.id);
    pending.resolve(value.result);
  };

  readonly #onTransportFailure = (): void => {
    this.#transportFailure();
  };

  #transportFailure(): void {
    if (this.#failed) return;
    this.#failed = true;
    this.#worker.removeEventListener("message", this.#onMessage);
    this.#worker.removeEventListener("error", this.#onTransportFailure);
    this.#worker.removeEventListener("messageerror", this.#onTransportFailure);
    this.#worker.terminate();
    const failure: StorageResult<never> = {
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    };
    for (const pending of this.#pending.values())
      pending.resolve(
        pending.method === "restoreUserData" && pending.dispatched
          ? { kind: "restore-outcome-unknown" }
          : failure,
      );
    this.#pending.clear();
  }
}

function isRpcResponse(value: unknown): value is RpcResponse {
  if (!plain(value) || typeof value.id !== "string" || value.id.length === 0)
    return false;
  if (value.kind === "result")
    return (
      exact(value, ["id", "kind", "result"]) && isStorageResult(value.result)
    );
  if (value.kind === "progress")
    return (
      exact(value, ["id", "kind", "progress"]) && validProgress(value.progress)
    );
  return (
    value.kind === "media-warning" &&
    exact(value, ["id", "kind", "warning"]) &&
    validWarning(value.warning)
  );
}
function isStorageResult(value: unknown): value is StorageResult<unknown> {
  if (!plain(value)) return false;
  if (value.kind === "ok") return exact(value, ["kind", "value"]);
  if (
    value.kind !== "failed" ||
    !exact(value, ["kind", "error"]) ||
    !plain(value.error)
  )
    return false;
  const keys = Object.keys(value.error);
  return (
    keys.every((key) =>
      ["code", "packageId", "requiredBy", "dependants", "path"].includes(key),
    ) && STORAGE_CODES.has(String(value.error.code))
  );
}
function validProgress(value: unknown): value is ImportProgress {
  return (
    plain(value) &&
    typeof value.operationId === "string" &&
    ["copying", "validating", "committing", "complete"].includes(
      String(value.phase),
    ) &&
    typeof value.fileName === "string" &&
    exact(value, [
      "operationId",
      "phase",
      "fileName",
      "copiedBytes",
      "totalBytes",
    ]) &&
    safeNonnegative(value.copiedBytes) &&
    safeNonnegative(value.totalBytes) &&
    Number(value.copiedBytes) <= Number(value.totalBytes)
  );
}
function validWarning(value: unknown): value is MediaWarning {
  return (
    plain(value) &&
    typeof value.packageId === "string" &&
    typeof value.path === "string" &&
    ["missing", "corrupt", "unreadable"].includes(String(value.reason)) &&
    exact(value, ["packageId", "path", "reason"])
  );
}
function safeNonnegative(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
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
const STORAGE_CODES = new Set([
  "SQLITE_UNAVAILABLE",
  "APP_ALREADY_OPEN",
  "APP_SESSION_ACTIVE",
  "PACKAGE_INVALID",
  "PACKAGE_SCHEMA_UNSUPPORTED",
  "PACKAGE_DEPENDENCY_MISSING",
  "PACKAGE_DEPENDENCY_INCOMPATIBLE",
  "PACKAGE_DEPENDENCY_CYCLE",
  "PACKAGE_DUPLICATE",
  "PACKAGE_IDENTITY_CONFLICT",
  "PACKAGE_INTEGRITY_FAILED",
  "PACKAGE_REFERENCED",
  "PACKAGE_NOT_FOUND",
  "PACKAGE_SOURCE_INCOMPLETE",
  "STORAGE_QUOTA_EXCEEDED",
  "STORAGE_UNAVAILABLE",
  "STORAGE_CONFLICT",
  "OPERATION_CANCELLED",
  "USER_DATA_INVALID",
  "USER_DATA_TOO_LARGE",
  "RESTORE_CONFIRMATION_REQUIRED",
  "RPC_INVALID",
]);
