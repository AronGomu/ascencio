/// <reference lib="webworker" />

import type { StorageFailure } from "./contracts/package.ts";
import type { RpcResponse } from "./contracts/rpc.ts";
import type { MediaWarning } from "./contracts/storage-client.ts";
import { AtomicPackageRuntime } from "./runtime/atomic-package-runtime.ts";
import { openBrowserSqliteRuntime } from "./runtime/browser-sqlite.ts";
import { StorageRpcDispatcher } from "./runtime/rpc-dispatch.ts";
import { UserDataRuntime } from "./runtime/user-data-runtime.ts";
import { requestLifetimeOwnerLock } from "./runtime/worker-lock.ts";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let dispatcher: StorageRpcDispatcher | null = null;
let openingFailure: StorageFailure | null = null;
let releaseOwner!: () => void;
let activeRequestId = "";
const pendingMessages: unknown[] = [];
let queue = Promise.resolve();
let transportFailed = false;

worker.addEventListener("message", (event) => {
  if (transportFailed) return;
  if (dispatcher === null && openingFailure === null) {
    pendingMessages.push(event.data);
    return;
  }
  enqueue(event.data);
});

void requestLifetimeOwnerLock(navigator.locks, async () => {
  try {
    const opened = await openBrowserSqliteRuntime();
    if (opened.kind === "failed") {
      openingFailure = opened.error;
      drainPending();
      return;
    }
    const browser = opened.value;
    const runtime = new AtomicPackageRuntime({
      registry: browser.registry,
      files: browser.files,
      now: () => new Date().toISOString(),
      randomId: () => crypto.randomUUID(),
      estimate: workerCapacityAvailable,
      mediaWarning: postMediaWarning,
    });
    const reconciled = await runtime.reconcileInterruptedImports();
    if (reconciled.kind === "failed") {
      if (browser.userData.kind === "ok") browser.userData.value.close();
      runtime.close();
      openingFailure = reconciled.error;
      drainPending();
      return;
    }
    const userData = new UserDataRuntime({
      ...(browser.userData.kind === "ok"
        ? { database: browser.userData.value }
        : { failure: browser.userData.error }),
      files: browser.files,
      randomId: () => crypto.randomUUID(),
    });
    const userReconciled = await userData.reconcileStagedBackups();
    if (userReconciled.kind === "failed") {
      try {
        await userData.close();
      } finally {
        runtime.close();
      }
      openingFailure = userReconciled.error;
      drainPending();
      return;
    }
    dispatcher = new StorageRpcDispatcher(runtime, post, userData);
    drainPending();
    await new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
  } catch {
    openingFailure = { code: "SQLITE_UNAVAILABLE" };
    drainPending();
  }
})
  .then(({ acquired }) => {
    if (!acquired) {
      openingFailure = { code: "APP_ALREADY_OPEN" };
      drainPending();
    }
  })
  .catch(() => {
    openingFailure = { code: "SQLITE_UNAVAILABLE" };
    drainPending();
  });

function enqueue(value: unknown): void {
  if (transportFailed) return;
  if (
    dispatcher !== null &&
    typeof value === "object" &&
    value !== null &&
    "method" in value &&
    value.method === "cancel"
  ) {
    void dispatcher.dispatch(value).catch(failTransport);
    return;
  }
  queue = queue
    .then(async () => {
      if (transportFailed) return;
      if (openingFailure !== null) {
        const id = requestId(value);
        post({
          id,
          kind: "result",
          result: { kind: "failed", error: openingFailure },
        });
        return;
      }
      const current = dispatcher;
      if (current === null) return;
      activeRequestId = requestId(value);
      const closes =
        typeof value === "object" &&
        value !== null &&
        "method" in value &&
        value.method === "close";
      await current.dispatch(value);
      activeRequestId = "";
      if (closes) releaseOwner();
    })
    .catch(failTransport);
}

function failTransport(): void {
  if (transportFailed) return;
  transportFailed = true;
  openingFailure = { code: "SQLITE_UNAVAILABLE" };
  worker.reportError(new Error("SQLite Worker response transport failed"));
}

function drainPending(): void {
  for (const value of pendingMessages.splice(0)) enqueue(value);
}

function post(value: RpcResponse): void {
  worker.postMessage(value);
}
function postMediaWarning(warning: MediaWarning): void {
  if (activeRequestId.length === 0) return;
  post({ id: activeRequestId, kind: "media-warning", warning });
}
function requestId(value: unknown): string {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
    ? value.id
    : "";
}

async function workerCapacityAvailable(
  requiredBytes: number,
): Promise<boolean> {
  const estimate = await navigator.storage.estimate();
  if (estimate.quota === undefined || estimate.usage === undefined) {
    console.warn(
      "SQLite import capacity unavailable; continuing without fictitious quota estimate.",
    );
    return true;
  }
  return estimate.quota - estimate.usage >= requiredBytes;
}
