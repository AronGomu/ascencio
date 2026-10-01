import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageRpcClient } from "../../../src/storage/runtime/rpc-client.ts";
import { createRuntimeFixture } from "./runtime-fixtures.ts";

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

async function startWorker(opened: unknown): Promise<{
  client: StorageRpcClient;
  scope: WorkerScope;
  transport: WorkerTransportBridge;
}> {
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

describe("SQLite Worker fatal reply transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    workerModuleState.opened = undefined;
  });

  it("escalates failed package replies and settles every pending request", async () => {
    const packages = createRuntimeFixture();
    const f = await startWorker({
      kind: "ok",
      value: { registry: packages.registry, files: packages.files },
    });
    f.scope.failReplies = true;
    const first = f.client.request("current", []);
    const second = f.client.request("current", []);
    await f.scope.secondFailedReply.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.scope.reportedErrors).toBe(1);
    await expect(first).resolves.toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    await expect(second).resolves.toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    f.client.closeTransport();
    expect(f.transport.terminated).toBe(1);
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
