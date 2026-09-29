import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageRpcClient } from "../../../src/storage/runtime/rpc-client.ts";
import { UserDataRuntime } from "../../../src/storage/runtime/user-data-runtime.ts";
import { createUserDataFixture } from "./sqlite-fixtures.ts";
import { createRuntimeFixture, databaseAdapter } from "./runtime-fixtures.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/index.ts";
import type { StorageResult } from "../../../src/storage/contracts/package.ts";
import type { RestoreOutcomeUnknown } from "../../../src/storage/contracts/user-data.ts";

const workerModuleState = vi.hoisted(() => ({ opened: undefined as unknown }));

vi.mock("../../../src/storage/runtime/browser-sqlite.ts", () => ({
  openBrowserSqliteRuntime: async () => workerModuleState.opened,
}));

class WorkerTransportBridge extends EventTarget {
  scope: WorkerScope | undefined;
  terminated = 0;

  postMessage(value: unknown): void {
    queueMicrotask(() => {
      this.scope?.dispatchEvent(new MessageEvent("message", { data: value }));
    });
  }

  terminate(): void {
    this.terminated += 1;
  }

  reply(value: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data: value }));
  }

  fail(): void {
    this.dispatchEvent(new Event("error"));
  }
}

class WorkerScope extends EventTarget {
  readonly #transport: WorkerTransportBridge;
  readonly secondFailedReply = Promise.withResolvers<void>();
  failReplies = false;
  failedReplies = 0;
  reportedErrors = 0;

  constructor(transport: WorkerTransportBridge) {
    super();
    this.#transport = transport;
  }

  postMessage(value: unknown): void {
    if (this.failReplies) {
      this.failedReplies += 1;
      if (this.failedReplies === 2) this.secondFailedReply.resolve();
      throw new Error("injected Worker reply failure");
    }
    this.#transport.reply(value);
  }

  reportError(): void {
    this.reportedErrors += 1;
    this.#transport.fail();
  }
}

interface WorkerFixture {
  readonly client: StorageRpcClient;
  readonly read: Promise<StorageResult<unknown>>;
  readonly restore: Promise<StorageResult<unknown> | RestoreOutcomeUnknown>;
  readonly scope: WorkerScope;
  readonly transport: WorkerTransportBridge;
  readonly userData: UserDataRuntime;
}

async function startWorker(
  opened: unknown,
): Promise<Pick<WorkerFixture, "client" | "scope" | "transport">> {
  vi.resetModules();
  workerModuleState.opened = opened;
  const transport = new WorkerTransportBridge();
  const scope = new WorkerScope(transport);
  transport.scope = scope;
  vi.stubGlobal("self", scope);
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object) => Promise<void>,
      ) => {
        void callback({});
      },
    },
    storage: { estimate: async () => ({}) },
  });
  await import("../../../src/storage/sqlite-worker.ts");
  return { client: new StorageRpcClient(transport), scope, transport };
}

async function restoreFixture(): Promise<WorkerFixture> {
  const packages = createRuntimeFixture();
  const database = createUserDataFixture();
  const adapter = databaseAdapter(database.database);
  const userData = new UserDataRuntime({
    database: adapter,
    files: packages.files,
    randomId: () => crypto.randomUUID(),
  });
  await userData.writeUser([
    {
      kind: "put",
      namespace: "preferences",
      key: "shell",
      expectedRevision: null,
      payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true },
    },
  ]);
  const exported = await userData.exportUserData();
  if (exported.kind !== "ok") throw new Error("export failed");
  const backup = new File(
    [await exported.value.arrayBuffer()],
    "user-data.sqlite",
  );
  await userData.writeUser([
    {
      kind: "put",
      namespace: "preferences",
      key: "shell",
      expectedRevision: 1,
      payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: false },
    },
  ]);
  const worker = await startWorker({
    kind: "ok",
    value: {
      registry: packages.registry,
      userData: { kind: "ok", value: adapter },
      files: packages.files,
    },
  });
  const inspected = await worker.client.request("inspectUserDataBackup", [
    backup,
  ]);
  if (inspected.kind !== "ok") throw new Error("inspect failed");
  const value = inspected.value as { token: string; currentRevision: number };
  worker.scope.failReplies = true;
  const restore = worker.client.request("restoreUserData", [
    value.token,
    value.currentRevision,
    true,
  ]);
  const read = worker.client.request("current", []);
  return { ...worker, userData, restore, read };
}

describe("SQLite Worker fatal reply transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    workerModuleState.opened = undefined;
  });

  it("escalates two failed reply posts after committed restore and settles every client request once", async () => {
    const f = await restoreFixture();
    const restoreSettled = vi.fn();
    const readSettled = vi.fn();
    void f.restore.then(restoreSettled);
    void f.read.then(readSettled);

    await f.scope.secondFailedReply.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.scope.failedReplies).toBe(2);
    expect(f.scope.reportedErrors).toBe(1);
    await expect(f.restore).resolves.toEqual({
      kind: "restore-outcome-unknown",
    });
    await expect(f.read).resolves.toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    expect(await f.userData.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { payload: { rotationNoticeDismissed: true } },
    });
    await expect(f.client.request("current", [])).resolves.toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });

    f.scope.reportError();
    f.client.closeTransport();
    expect(restoreSettled).toHaveBeenCalledOnce();
    expect(readSettled).toHaveBeenCalledOnce();
    expect(f.transport.terminated).toBe(1);
    await f.userData.close();
  });

  it("keeps normal startup failure authoritative without transport escalation", async () => {
    const f = await startWorker({
      kind: "failed",
      error: { code: "APP_ALREADY_OPEN" },
    });
    await expect(f.client.request("current", [])).resolves.toEqual({
      kind: "failed",
      error: { code: "APP_ALREADY_OPEN" },
    });
    expect(f.scope.reportedErrors).toBe(0);
    expect(f.transport.terminated).toBe(0);
    f.client.closeTransport();
    expect(f.transport.terminated).toBe(1);
  });
});
