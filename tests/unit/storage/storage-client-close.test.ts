import { afterEach, describe, expect, it, vi } from "vitest";
import { openLocalStorage } from "../../../src/storage/create-storage-client.ts";

class CloseWorker extends EventTarget {
  terminated = 0;

  postMessage(value: unknown): void {
    const request = value as { readonly id: string; readonly method: string };
    const result =
      request.method === "close"
        ? {
            kind: "failed" as const,
            error: { code: "STORAGE_UNAVAILABLE" as const },
          }
        : { kind: "ok" as const, value: { generation: 0, packages: [] } };
    queueMicrotask(() =>
      this.dispatchEvent(
        new MessageEvent("message", {
          data: { id: request.id, kind: "result", result },
        }),
      ),
    );
  }

  terminate(): void {
    this.terminated += 1;
  }
}

describe("SQLite storage client close", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("terminates injected transport when close RPC rejects while preserving error", async () => {
    const worker = new CloseWorker();
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          return worker;
        }
      },
    );
    vi.stubGlobal("navigator", {
      storage: {},
      locks: {},
    });

    const opened = await openLocalStorage();
    expect(opened.kind).toBe("ok");
    if (opened.kind !== "ok") return;

    await expect(opened.value.close()).rejects.toThrow("STORAGE_UNAVAILABLE");
    expect(worker.terminated).toBe(1);
  });
});
