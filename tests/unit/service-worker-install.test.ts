// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestCacheStorage } from "../fixtures/progressive-storage.ts";

const precache = vi.hoisted(() => ({
  addToCacheList: vi.fn(),
  install: vi.fn(async () => undefined),
}));
vi.mock("workbox-precaching", () => ({
  PrecacheController: class {
    addToCacheList = precache.addToCacheList;
    install = precache.install;
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

async function worker(cacheStorage: TestCacheStorage, active = false) {
  vi.resetModules();
  vi.stubGlobal("__APP_BUILD_ID__", "test-build");
  vi.stubGlobal("__CORE_CONTENT_API_VERSION__", 1);
  const listeners = new Map<string, (event: unknown) => void>();
  vi.stubGlobal("self", {
    __WB_MANIFEST: [],
    registration: { active: active ? {} : null, scope: "https://app.test/" },
    caches: {
      open: cacheStorage.open.bind(cacheStorage),
      keys: async () => [...cacheStorage.stores.keys()],
      delete: cacheStorage.delete.bind(cacheStorage),
    },
    indexedDB: new IDBFactory(),
    addEventListener: (name: string, callback: (event: unknown) => void) =>
      listeners.set(name, callback),
  });
  await import("../../src/service-worker.ts");
  return (eventName = "install") =>
    new Promise<void>((resolve, reject) => {
      listeners.get(eventName)!({
        waitUntil: (work: Promise<void>) => {
          work.then(resolve, reject);
        },
      });
    });
}

describe("CORE install consent", () => {
  it("retries interrupted first install after partial precache without approval", async () => {
    const caches = new TestCacheStorage();
    precache.install.mockImplementationOnce(async () => {
      await (
        await caches.open("ygo-core-shell-partial")
      ).put("https://app.test/index.html", new Response("partial"));
      throw new Error("precache failed");
    });
    await expect((await worker(caches))()).rejects.toThrow("precache failed");
    await expect((await worker(caches))()).resolves.toBeUndefined();
    expect(precache.install).toHaveBeenCalledTimes(2);
  });

  it("requires approval after activation even if worker registration is lost", async () => {
    const caches = new TestCacheStorage();
    const first = await worker(caches);
    await first();
    await first("activate");
    await expect((await worker(caches))()).rejects.toThrow(
      "CORE_UPDATE_NOT_APPROVED",
    );
    expect(precache.install).toHaveBeenCalledOnce();
  });

  it("retries first install if browser stops after precache but before activation", async () => {
    const caches = new TestCacheStorage();
    await (
      await worker(caches)
    )();
    await expect((await worker(caches))()).resolves.toBeUndefined();
    expect(precache.install).toHaveBeenCalledTimes(2);
  });

  it("requires approval with an active legacy worker even without install marker", async () => {
    await expect(
      (await worker(new TestCacheStorage(), true))(),
    ).rejects.toThrow("CORE_UPDATE_NOT_APPROVED");
    expect(precache.install).not.toHaveBeenCalled();
  });
});
