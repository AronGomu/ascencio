import { beforeEach, describe, expect, it, vi } from "vitest";
import { openNativeStorage } from "../../../src/storage/native/storage-client.ts";
import type { StorageResult } from "../../../src/storage/contracts/package.ts";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));

const acquired = (sessionId = "session-1") => ({
  kind: "ok" as const,
  value: { sessionId, generation: 3 },
});
const unavailable = {
  kind: "failed",
  error: { code: "STORAGE_UNAVAILABLE" },
};

beforeEach(() => {
  native.invoke.mockReset();
  native.invoke.mockImplementation(async (command: string) => {
    if (command === "native_package_stack")
      return {
        kind: "ok",
        value: {
          generation: 3,
          packages: [],
          readiness: { duel: false, story: false },
        },
      };
    if (command === "native_package_acquire") return acquired();
    if (command === "native_package_release") return undefined;
    throw new Error(`Unexpected command: ${command}`);
  });
});

async function client() {
  const opened = await openNativeStorage();
  if (opened.kind === "failed") throw new Error(opened.error.code);
  return opened.value;
}

const calls = (command: string) =>
  native.invoke.mock.calls.filter(([called]) => called === command);
const nextTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("native storage client close", () => {
  it("drains an admitted acquisition, rejects its late lease, and releases it before close settles", async () => {
    const storage = await client();
    const acquire = Promise.withResolvers<ReturnType<typeof acquired>>();
    const release = Promise.withResolvers<void>();
    native.invoke.mockImplementation((command: string) => {
      if (command === "native_package_acquire") return acquire.promise;
      if (command === "native_package_release") return release.promise;
      throw new Error(`Unexpected command: ${command}`);
    });
    const pending = storage.packages.acquireSession();
    const closing = storage.close();
    let closed = false;
    void closing.then(() => {
      closed = true;
    });
    expect(await storage.packages.acquireSession()).toEqual(unavailable);
    await nextTurn();
    const closedBeforeAcquisition = closed;
    acquire.resolve(acquired());
    const result = await pending;
    await nextTurn();
    const closedBeforeRelease = closed;
    release.resolve();
    await closing;
    expect(closedBeforeAcquisition).toBe(false);
    expect(closedBeforeRelease).toBe(false);
    expect(result).toEqual(unavailable);
    expect(calls("native_package_acquire")).toHaveLength(1);
    expect(calls("native_package_release")).toEqual([
      ["native_package_release", { sessionId: "session-1" }],
    ]);
  });

  it("shares repeated release and close promises and waits for an in-flight release", async () => {
    const storage = await client();
    const result = await storage.packages.acquireSession();
    if (result.kind === "failed") throw new Error(result.error.code);
    const gate = Promise.withResolvers<void>();
    native.invoke.mockImplementationOnce(() => gate.promise);
    const releasing = result.value.release();
    const repeatedRelease = result.value.release();
    const closing = storage.close();
    const repeatedClose = storage.close();
    let closed = false;
    void closing.then(() => {
      closed = true;
    });
    await nextTurn();
    const closedBeforeRelease = closed;
    gate.resolve();
    await Promise.all([releasing, repeatedRelease, closing, repeatedClose]);
    expect(repeatedRelease).toBe(releasing);
    expect(repeatedClose).toBe(closing);
    expect(closedBeforeRelease).toBe(false);
    await result.value.release();
    expect(calls("native_package_release")).toHaveLength(1);
  });

  it("releases a normal active lease once when close owns cleanup", async () => {
    const storage = await client();
    const result = await storage.packages.acquireSession();
    if (result.kind === "failed") throw new Error(result.error.code);
    await storage.close();
    await result.value.release();
    await storage.close();
    expect(calls("native_package_release")).toHaveLength(1);
    expect(await storage.packages.current()).toEqual(unavailable);
  });

  it.each(["failure", "rejection"] as const)(
    "drains an acquisition %s without inventing a release",
    async (kind) => {
      const storage = await client();
      const gate = Promise.withResolvers<StorageResult<never>>();
      native.invoke.mockImplementationOnce(() => gate.promise);
      const pending = storage.packages.acquireSession();
      const closing = storage.close();
      const failure = {
        kind: "failed" as const,
        error: { code: "STORAGE_CONFLICT" as const },
      };
      if (kind === "failure") gate.resolve(failure);
      else gate.reject(new Error("transport failed"));
      expect(await pending).toEqual(kind === "failure" ? failure : unavailable);
      await closing;
      expect(calls("native_package_release")).toHaveLength(0);
    },
  );

  it("preserves cleanup errors while draining the remaining sessions", async () => {
    const storage = await client();
    native.invoke.mockResolvedValueOnce(acquired("session-1"));
    native.invoke.mockResolvedValueOnce(acquired("session-2"));
    await storage.packages.acquireSession();
    await storage.packages.acquireSession();
    const failure = new Error("release failed");
    const gate = Promise.withResolvers<void>();
    native.invoke.mockImplementation(
      (command: string, args: { sessionId: string }) => {
        if (command !== "native_package_release") throw new Error(command);
        return args.sessionId === "session-1"
          ? Promise.reject(failure)
          : gate.promise;
      },
    );
    const closing = storage.close();
    let settled = false;
    const outcome = closing.catch((error: unknown) => {
      settled = true;
      return error;
    });
    await nextTurn();
    const settledBeforeRelease = settled;
    gate.resolve();
    expect(await outcome).toBe(failure);
    expect(settledBeforeRelease).toBe(false);
    await expect(storage.close()).rejects.toBe(failure);
    expect(calls("native_package_release")).toHaveLength(2);
  });

  it("still releases content sessions when user-data close fails", async () => {
    const storage = await client();
    await storage.packages.acquireSession();
    const failure = new Error("user-data close failed");
    vi.spyOn(
      storage.userData as unknown as { close(): Promise<void> },
      "close",
    ).mockRejectedValueOnce(failure);
    await expect(storage.close()).rejects.toBe(failure);
    expect(native.invoke).toHaveBeenCalledWith("native_package_release", {
      sessionId: "session-1",
    });
  });
});
