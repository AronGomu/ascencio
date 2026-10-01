import type { RpcArgs, RpcRequest, RpcResponse } from "../contracts/rpc.ts";
import type { PackageId, StorageResult } from "../contracts/package.ts";
import type { AtomicPackageRuntime } from "./atomic-package-runtime.ts";
import { validQuery } from "./content-query-runtime.ts";
import type { UserDataStore } from "../contracts/user-data.ts";
type ManagedUserStore = Omit<UserDataStore, "restoreUserData"> & {
  restoreUserData(
    ...args: Parameters<UserDataStore["restoreUserData"]>
  ): Promise<StorageResult<{ readonly revision: number }>>;
  close(): Promise<void>;
};

const METHODS = [
  "current",
  "importPackages",
  "verifyInstalled",
  "removePackage",
  "cleanupUnused",
  "acquireSession",
  "releaseSession",
  "query",
  "readUser",
  "listUser",
  "writeUser",
  "exportUserData",
  "inspectUserDataBackup",
  "restoreUserData",
  "cancel",
  "close",
] as const satisfies readonly (keyof RpcArgs)[];
export function validateRpcRequest(value: unknown): StorageResult<RpcRequest> {
  if (
    !plain(value) ||
    !exact(value, ["id", "method", "args"]) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    value.id.length > 128 ||
    typeof value.method !== "string" ||
    !METHODS.includes(value.method as keyof RpcArgs) ||
    !denseArray(value.args) ||
    !validArgs(value.method as keyof RpcArgs, value.args)
  )
    return invalid();
  return { kind: "ok", value: value as unknown as RpcRequest };
}

export class StorageRpcDispatcher {
  readonly #runtime: AtomicPackageRuntime;
  readonly #post: (value: RpcResponse) => void;
  readonly #userData: ManagedUserStore | undefined;
  readonly #controllers = new Map<string, AbortController>();
  readonly #sessions = new Map<string, () => Promise<void>>();

  constructor(
    runtime: AtomicPackageRuntime,
    post: (value: RpcResponse) => void,
    userData?: ManagedUserStore,
  ) {
    this.#runtime = runtime;
    this.#post = post;
    this.#userData = userData;
  }

  async dispatch(value: unknown): Promise<void> {
    const parsed = validateRpcRequest(value);
    if (parsed.kind === "failed") {
      const id = plain(value) && typeof value.id === "string" ? value.id : "";
      this.#post({ id, kind: "result", result: parsed });
      return;
    }
    const request = parsed.value;
    try {
      switch (request.method) {
        case "current":
          this.#result(request.id, await this.#runtime.current());
          return;
        case "importPackages": {
          const controller = new AbortController();
          this.#controllers.set(request.id, controller);
          const [files, generation] = request.args;
          const result = await this.#runtime.importPackages(
            files,
            generation,
            controller.signal,
            (progress) => {
              this.#controllers.set(progress.operationId, controller);
              this.#post({ id: request.id, kind: "progress", progress });
            },
          );
          this.#controllers.delete(request.id);
          for (const [id, current] of this.#controllers)
            if (current === controller) this.#controllers.delete(id);
          this.#result(request.id, result);
          return;
        }
        case "verifyInstalled": {
          const controller = new AbortController();
          this.#controllers.set(request.id, controller);
          const result = await this.#runtime.verifyInstalled(controller.signal);
          this.#controllers.delete(request.id);
          this.#result(request.id, result);
          return;
        }
        case "removePackage":
          this.#result(
            request.id,
            await this.#runtime.removePackage(...request.args),
          );
          return;
        case "cleanupUnused":
          this.#result(request.id, await this.#runtime.cleanupUnused());
          return;
        case "acquireSession": {
          const acquired = await this.#runtime.acquireSession();
          if (acquired.kind === "failed") {
            this.#result(request.id, acquired);
            return;
          }
          const sessionId = crypto.randomUUID();
          this.#sessions.set(sessionId, acquired.value.release);
          this.#result(request.id, {
            kind: "ok",
            value: { generation: acquired.value.generation, sessionId },
          });
          return;
        }
        case "releaseSession": {
          const release = this.#sessions.get(request.args[0]);
          if (!release) {
            this.#result(request.id, invalid());
            return;
          }
          this.#sessions.delete(request.args[0]);
          await release();
          this.#result(request.id, { kind: "ok", value: undefined });
          return;
        }
        case "query": {
          const controller = new AbortController();
          this.#controllers.set(request.id, controller);
          const result = await this.#runtime.query(
            request.args[0],
            controller.signal,
          );
          this.#controllers.delete(request.id);
          this.#result(request.id, result);
          return;
        }
        case "readUser":
          this.#result(
            request.id,
            this.#userData
              ? await this.#userData.readUser(...request.args)
              : unavailable(),
          );
          return;
        case "listUser":
          this.#result(
            request.id,
            this.#userData
              ? await this.#userData.listUser(...request.args)
              : unavailable(),
          );
          return;
        case "writeUser":
          this.#result(
            request.id,
            this.#userData
              ? await this.#userData.writeUser(...request.args)
              : unavailable(),
          );
          return;
        case "exportUserData":
          this.#result(
            request.id,
            this.#userData
              ? await this.#userData.exportUserData()
              : unavailable(),
          );
          return;
        case "inspectUserDataBackup":
          this.#result(
            request.id,
            this.#userData
              ? await this.#userData.inspectUserDataBackup(...request.args)
              : unavailable(),
          );
          return;
        case "restoreUserData":
          this.#result(
            request.id,
            this.#userData
              ? await this.#userData.restoreUserData(...request.args)
              : unavailable(),
          );
          return;
        case "cancel": {
          this.#controllers.get(request.args[0])?.abort();
          this.#result(request.id, { kind: "ok", value: undefined });
          return;
        }
        case "close":
          for (const controller of this.#controllers.values())
            controller.abort();
          for (const release of this.#sessions.values()) await release();
          this.#controllers.clear();
          this.#sessions.clear();
          try {
            await this.#userData?.close();
          } finally {
            this.#runtime.close();
          }
          this.#result(request.id, { kind: "ok", value: undefined });
          return;
      }
    } catch {
      this.#result(request.id, {
        kind: "failed",
        error: { code: "STORAGE_UNAVAILABLE" },
      });
    }
  }

  #result(id: string, result: StorageResult<unknown>): void {
    this.#post({ id, kind: "result", result });
  }
}

export async function dispatchRpcRequest(
  request: RpcRequest,
  runtime: AtomicPackageRuntime,
  post: (value: RpcResponse) => void,
  userData?: ManagedUserStore,
): Promise<void> {
  await new StorageRpcDispatcher(runtime, post, userData).dispatch(request);
}

function validArgs(method: keyof RpcArgs, args: readonly unknown[]): boolean {
  switch (method) {
    case "current":
    case "verifyInstalled":
    case "cleanupUnused":
    case "acquireSession":
    case "exportUserData":
    case "close":
      return args.length === 0;
    case "importPackages":
      return (
        args.length === 2 &&
        Array.isArray(args[0]) &&
        denseArray(args[0]) &&
        args[0].length > 0 &&
        args[0].length <= 256 &&
        args[0].every((file) => file instanceof File) &&
        safeNonnegative(args[1])
      );
    case "removePackage":
      return (
        args.length === 2 && validPackageId(args[0]) && safeNonnegative(args[1])
      );
    case "releaseSession":
    case "cancel":
      return args.length === 1 && nonemptyBounded(args[0], 128);
    case "query":
      return args.length === 1 && validQuery(args[0]);
    case "readUser":
      return (
        args.length === 2 &&
        validNamespace(args[0]) &&
        nonemptyBounded(args[1], 256)
      );
    case "listUser":
      return args.length === 1 && validNamespace(args[0]);
    case "writeUser":
      return (
        args.length === 1 &&
        Array.isArray(args[0]) &&
        denseArray(args[0]) &&
        args[0].length <= 1024 &&
        args[0].every(validUserMutation)
      );
    case "inspectUserDataBackup":
      return args.length === 1 && args[0] instanceof File;
    case "restoreUserData":
      return (
        args.length === 3 &&
        nonemptyBounded(args[0], 128) &&
        safeNonnegative(args[1]) &&
        args[2] === true
      );
  }
}
function validPackageId(value: unknown): value is PackageId {
  return (
    value === "duel-core" ||
    value === "card-library" ||
    value === "freeplay" ||
    (typeof value === "string" &&
      (/^chapter-(?:0[1-9]|[1-9][0-9]+)$/.test(value) ||
        (value.length <= 128 &&
          /^card-pack-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))))
  );
}
function validUserMutation(value: unknown): boolean {
  if (!plain(value) || typeof value.kind !== "string") return false;
  if (value.kind === "put")
    return (
      exact(value, [
        "kind",
        "namespace",
        "key",
        "expectedRevision",
        "payload",
      ]) &&
      validNamespace(value.namespace) &&
      nonemptyBounded(value.key, 256) &&
      (value.expectedRevision === null ||
        positiveRevision(value.expectedRevision))
    );
  if (value.kind === "delete")
    return (
      exact(value, ["kind", "namespace", "key", "expectedRevision"]) &&
      validNamespace(value.namespace) &&
      nonemptyBounded(value.key, 256) &&
      positiveRevision(value.expectedRevision)
    );
  return false;
}
function validNamespace(value: unknown): boolean {
  return (
    typeof value === "string" &&
    [
      "decks",
      "deck-meta",
      "deck-autosaves",
      "story",
      "preferences",
      "story-read-log",
    ].includes(value)
  );
}
function safeNonnegative(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function positiveRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}
function nonemptyBounded(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maximum
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
function denseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, index)) return false;
  return true;
}
function invalid<T>(): StorageResult<T> {
  return { kind: "failed", error: { code: "RPC_INVALID" } };
}
function unavailable<T>(): StorageResult<T> {
  return { kind: "failed", error: { code: "SQLITE_UNAVAILABLE" } };
}
