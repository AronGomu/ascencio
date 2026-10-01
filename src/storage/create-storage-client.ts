import { createModuleCatalogQueries } from "./modules/catalog-queries.ts";
import type {
  ContentQuery,
  ImportProgress,
  LocalStorageClient,
  PackageStack,
  QueryMap,
} from "./contracts/storage-client.ts";
import type { RpcArgs } from "./contracts/rpc.ts";
import type { StorageResult } from "./contracts/package.ts";
import { openBrowserUserData } from "./json/browser-user-data.ts";
import { StorageRpcClient } from "./runtime/rpc-client.ts";
import { isTauri } from "@tauri-apps/api/core";

export async function openLocalStorage(): Promise<
  StorageResult<LocalStorageClient>
> {
  if (isTauri()) {
    const { openNativeStorage } = await import("./native/storage-client.ts");
    return await openNativeStorage();
  }
  if (
    typeof Worker === "undefined" ||
    typeof navigator === "undefined" ||
    navigator.storage === undefined ||
    navigator.locks === undefined
  )
    return unavailable();
  const worker = new Worker(new URL("./sqlite-worker.ts", import.meta.url), {
    type: "module",
    name: "ascencio-sqlite",
  });
  const rpc = new StorageRpcClient(worker);
  const opened = await rpc.request("current", []);
  if (opened.kind === "failed") {
    rpc.closeTransport();
    return opened as StorageResult<LocalStorageClient>;
  }
  return { kind: "ok", value: createFacade(rpc) };
}

function createFacade(rpc: StorageRpcClient): LocalStorageClient {
  let closed = false;
  const userData = openBrowserUserData();
  return {
    packages: {
      current: async () => cast(await rpc.request("current", [])),
      importPackages: async (files, generation, signal, progress) => {
        if (closed) return unavailable();
        await reportClientCapacity(files);
        return await cancellableRequest<PackageStack>(
          rpc,
          "importPackages",
          [files, generation],
          signal,
          progress,
        );
      },
      verifyInstalled: async (signal) =>
        await cancellableRequest<PackageStack>(
          rpc,
          "verifyInstalled",
          [],
          signal,
        ),
      removePackage: async (packageId, generation) =>
        cast(await rpc.request("removePackage", [packageId, generation])),
      cleanupUnused: async () => cast(await rpc.request("cleanupUnused", [])),
      acquireSession: async () => {
        const result = await rpc.request("acquireSession", []);
        if (result.kind === "failed") return result;
        const session = result.value;
        if (!sessionResult(session))
          return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
        let released = false;
        return {
          kind: "ok",
          value: {
            generation: session.generation,
            release: async () => {
              if (released) return;
              released = true;
              requireRpcSuccess(
                await rpc.request("releaseSession", [session.sessionId]),
              );
            },
          },
        };
      },
    },
    content: createModuleCatalogQueries(
      {
        query: async <Q extends ContentQuery>(
          request: Q,
          signal: AbortSignal,
        ) =>
          await cancellableRequest<QueryMap[Q["kind"]]>(
            rpc,
            "query",
            [request],
            signal,
          ),
      },
      async () => cast(await rpc.request("current", [])),
    ),
    userData,
    subscribeMediaWarnings: (listener) => rpc.subscribeMediaWarnings(listener),
    close: async () => {
      if (closed) return;
      closed = true;
      try {
        await userData.close();
        requireRpcSuccess(await rpc.request("close", []));
      } finally {
        rpc.closeTransport();
      }
    },
  };
}

async function cancellableRequest<
  T,
  M extends Exclude<keyof RpcArgs, "restoreUserData"> = Exclude<
    keyof RpcArgs,
    "restoreUserData"
  >,
>(
  rpc: StorageRpcClient,
  method: M,
  args: RpcArgs[M],
  signal: AbortSignal,
  progress?: (event: ImportProgress) => void,
): Promise<StorageResult<T>> {
  if (signal.aborted)
    return { kind: "failed", error: { code: "OPERATION_CANCELLED" } };
  let requestId = "";
  let abort!: () => void;
  const aborted = new Promise<"aborted">((resolve) => {
    abort = () => resolve("aborted");
  });
  signal.addEventListener("abort", abort, { once: true });
  const pending = rpc.request(method, args, {
    ...(progress ? { progress } : {}),
    onRequestId: (id) => {
      requestId = id;
    },
  });
  const first = await Promise.race([
    pending.then(() => "result" as const),
    aborted,
  ]);
  if (first === "aborted") {
    const cancellation = await rpc.request("cancel", [requestId]);
    if (cancellation.kind === "failed") {
      signal.removeEventListener("abort", abort);
      return cast(cancellation);
    }
  }
  signal.removeEventListener("abort", abort);
  return cast(await pending);
}

async function reportClientCapacity(files: readonly File[]): Promise<void> {
  const required =
    files.reduce((total, file) => total + file.size, 0) + 8 * 1024 * 1024;
  try {
    const persisted = await navigator.storage.persist();
    if (!persisted)
      console.warn(
        "Persistent storage denied; import remains available but eviction risk is visible.",
      );
  } catch {
    console.warn(
      "Persistent storage status unavailable; import remains available.",
    );
  }
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota === undefined || estimate.usage === undefined) {
      console.warn(
        "Storage capacity estimate unavailable; import will rely on the OPFS write result.",
      );
      return;
    }
    const available = estimate.quota - estimate.usage;
    if (available < required)
      console.warn(
        `Browser-reported storage estimate is below the import size (${available} available; ${required} required). Attempting the OPFS write because privacy protections may mask the real quota.`,
      );
  } catch {
    console.warn(
      "Storage capacity estimate failed; import will rely on the OPFS write result.",
    );
  }
}

function sessionResult(
  value: unknown,
): value is { readonly generation: number; readonly sessionId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "generation" in value &&
    Number.isSafeInteger(value.generation) &&
    "sessionId" in value &&
    typeof value.sessionId === "string" &&
    value.sessionId.length > 0
  );
}
function cast<T>(value: StorageResult<unknown>): StorageResult<T> {
  return value as StorageResult<T>;
}
function unavailable<T>(): StorageResult<T> {
  return { kind: "failed", error: { code: "SQLITE_UNAVAILABLE" } };
}
function requireRpcSuccess(result: StorageResult<unknown>): void {
  if (result.kind === "failed") throw new Error(result.error.code);
}
