import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openProgressiveContentStore,
  type ProgressiveContentStore,
} from "../../src/content/index.ts";
import * as validation from "../../src/content/storage/progressive-storage-validation.ts";
import { createProgressiveFixture } from "../fixtures/progressive-release.ts";
import {
  PROGRESSIVE_DATABASE_NAME,
  resetProgressiveStorage,
  TestCacheStorage,
} from "../fixtures/progressive-storage.ts";

let cache: TestCacheStorage;
const stores: ProgressiveContentStore[] = [];
const signal = () => new AbortController().signal;
async function open() {
  const store = await openProgressiveContentStore(
    "http://127.0.0.1/progressive/",
  );
  stores.push(store);
  return store;
}
async function stage(
  store: ProgressiveContentStore,
  releaseSequence = 1,
  optionalMedia = true,
) {
  const fixture = await createProgressiveFixture({
    releaseSequence,
    optionalMedia,
  });
  vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
  const pointer = await store.fetchLatest(signal());
  const manifest = await store.cacheManifest(pointer, signal());
  return { pointer, manifest };
}
beforeEach(async () => {
  cache = new TestCacheStorage();
  vi.stubGlobal("caches", cache);
  vi.stubGlobal("location", new URL("https://app.test/play/"));
  await resetProgressiveStorage(cache);
});
afterEach(async () => {
  for (const store of stores.splice(0)) store.close();
  vi.restoreAllMocks();
  await resetProgressiveStorage(cache);
  vi.unstubAllGlobals();
});

describe("verified one-entry parsed manifest memo", () => {
  it("parses once while rereading and hashing the current manifest for every file read", async () => {
    const store = await open();
    const { pointer } = await stage(store);
    const parse = vi.spyOn(validation, "parsedManifest");
    const digest = vi.spyOn(crypto.subtle, "digest");
    const get = vi.spyOn(IDBObjectStore.prototype, "get");
    for (let index = 0; index < 12; index++)
      expect(
        await store.readFile(
          pointer.manifest.version,
          "images/card.svg",
          signal(),
        ),
      ).toBeNull();
    expect(
      get.mock.contexts.filter(
        (store) =>
          store instanceof IDBObjectStore && store.name === "manifests",
      ),
    ).toHaveLength(12);
    expect(digest).toHaveBeenCalledTimes(12);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it.each(["corrupt", "evicted", "replaced", "wrong-row-version"] as const)(
    "rejects %s persisted metadata after a warm read",
    async (mutation) => {
      const store = await open();
      const a = await stage(store);
      const b = await stage(store, 2, false);
      await store.readManifest(a.pointer.manifest.version);
      const db = await openDB(PROGRESSIVE_DATABASE_NAME);
      try {
        const row = await db.get("manifests", a.pointer.manifest.version);
        if (mutation === "evicted")
          await db.delete("manifests", a.pointer.manifest.version);
        else {
          if (mutation === "corrupt") row.bytes[0] ^= 1;
          if (mutation === "replaced")
            row.bytes = (
              await db.get("manifests", b.pointer.manifest.version)
            ).bytes;
          if (mutation === "wrong-row-version")
            row.version = b.pointer.manifest.version;
          await db.put("manifests", row, a.pointer.manifest.version);
        }
        await expect(
          store.readFile(
            a.pointer.manifest.version,
            "images/card.svg",
            signal(),
          ),
        ).rejects.toMatchObject({
          code:
            mutation === "evicted"
              ? "CONTENT_MISSING"
              : "CONTENT_INTEGRITY_FAILED",
        });
      } finally {
        db.close();
      }
    },
  );

  it("keeps nested caller mutation outside the private verified manifest", async () => {
    const store = await open();
    const { pointer, manifest } = await stage(store);
    const first = await store.readManifest(pointer.manifest.version);
    Reflect.set(first.coreRange, "min", 900);
    Reflect.set(first.files[0]!, "path", "forged.json");
    Reflect.set(first.files[0]!.packIds, 0, "chapter-99");
    Reflect.set(first.chapters[0]!.depends, 0, "chapter-99");
    const second = await store.readManifest(pointer.manifest.version);
    expect(second).toEqual(manifest);
    expect(second).not.toBe(first);
    expect(
      await store.readFile(
        pointer.manifest.version,
        "images/card.svg",
        signal(),
      ),
    ).toBeNull();
    await expect(
      store.readFile(pointer.manifest.version, "forged.json", signal()),
    ).rejects.toMatchObject({ code: "CONTENT_INVALID_MANIFEST" });
  });

  it("bounds memo to one version and preserves interleaved version membership", async () => {
    const store = await open();
    const a = await stage(store);
    const b = await stage(store, 2, false);
    const parse = vi.spyOn(validation, "parsedManifest");
    for (const version of [
      a.pointer.manifest.version,
      b.pointer.manifest.version,
      a.pointer.manifest.version,
    ])
      await store.readManifest(version);
    expect(parse).toHaveBeenCalledTimes(3);
    for (let index = 0; index < 4; index++) {
      const results = await Promise.allSettled([
        store.readFile(a.pointer.manifest.version, "images/card.svg", signal()),
        store.readFile(b.pointer.manifest.version, "images/card.svg", signal()),
        store.readManifest(a.pointer.manifest.version),
        store.readManifest(b.pointer.manifest.version),
      ]);
      expect(results[0]).toEqual({ status: "fulfilled", value: null });
      expect(results[1]).toMatchObject({
        status: "rejected",
        reason: { code: "CONTENT_INVALID_MANIFEST" },
      });
      expect(results[2]).toMatchObject({
        status: "fulfilled",
        value: a.manifest,
      });
      expect(results[3]).toMatchObject({
        status: "fulfilled",
        value: b.manifest,
      });
    }
  });

  it("rechecks current file receipts and bodies after warming metadata; abort stays effective", async () => {
    const store = await open();
    const { pointer } = await stage(store);
    await store.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: pointer.manifest.version,
        chapterIds: ["chapter-01"],
        kind: "required",
      },
      signal(),
      () => undefined,
    );
    const staged = await store.sealRequired(pointer.manifest.version, [
      "chapter-01",
    ]);
    await store.readManifest(pointer.manifest.version);
    const db = await openDB(PROGRESSIVE_DATABASE_NAME);
    try {
      const path = "runtime/manifest.json";
      const row = (await db.getAll("files")).find((row) => row.path === path)!;
      const body = cache.cache().entries.get(row.cacheKey)!;
      cache.cache().entries.set(row.cacheKey, new Response("corrupt"));
      await expect(
        store.readFile(pointer.manifest.version, path, signal()),
      ).rejects.toMatchObject({ code: "CONTENT_INTEGRITY_FAILED" });
      cache.cache().entries.set(row.cacheKey, body);
      const aborted = new AbortController();
      aborted.abort();
      await expect(
        store.readFile(pointer.manifest.version, path, aborted.signal),
      ).rejects.toMatchObject({ code: "CONTENT_CANCELLED" });
      cache.cache().entries.delete(row.cacheKey);
      await expect(
        store.readFile(pointer.manifest.version, path, signal()),
      ).rejects.toMatchObject({ code: "CONTENT_INTEGRITY_FAILED" });
      await db.delete("files", [row.path, row.version]);
      expect(
        await store.readFile(pointer.manifest.version, path, signal()),
      ).toBeNull();
      await expect(
        store.verifyRequired(staged, signal()),
      ).rejects.toMatchObject({ code: "CONTENT_MISSING" });
    } finally {
      db.close();
    }
  });

  it("close during digest cannot repopulate or serve the parsed memo", async () => {
    const store = await open();
    const { pointer } = await stage(store);
    await store.readManifest(pointer.manifest.version);
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let release!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(
      async (algorithm, bytes) => {
        const value = await digest(algorithm, bytes);
        entered();
        await waiting;
        return value;
      },
    );
    const reading = store.readManifest(pointer.manifest.version);
    await started;
    store.close();
    release();
    await expect(reading).rejects.toMatchObject({
      code: "CONTENT_STORAGE_UNAVAILABLE",
    });
  });

  it("closed stores refuse reads; reopened stores reparse current bytes", async () => {
    const store = await open();
    const { pointer } = await stage(store);
    await store.readManifest(pointer.manifest.version);
    store.close();
    await expect(
      store.readManifest(pointer.manifest.version),
    ).rejects.toMatchObject({ code: "CONTENT_STORAGE_UNAVAILABLE" });
    const next = await open();
    const parse = vi.spyOn(validation, "parsedManifest");
    await next.readManifest(pointer.manifest.version);
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
