import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openProgressiveContentStore,
  type ContentError,
  type DownloadJob,
  type ProgressiveContentStore,
} from "../../src/content/index.ts";
import { progressiveFileKey } from "../../src/content/storage/content-cache.ts";
import { createProgressiveFixture } from "../fixtures/progressive-release.ts";
import {
  PROGRESSIVE_CACHE_NAME,
  PROGRESSIVE_DATABASE_NAME,
  progressiveDatabaseSnapshot,
  resetProgressiveStorage,
  TestCacheStorage,
  TestLockManager,
} from "../fixtures/progressive-storage.ts";

const stores: ProgressiveContentStore[] = [];
let cacheStorage: TestCacheStorage;

function error(code: ContentError["code"]): {
  readonly name: string;
  readonly code: string;
  readonly message: string;
} {
  return { name: "ContentError", code, message: code };
}

async function open(baseUrl: string | null): Promise<ProgressiveContentStore> {
  const store = await openProgressiveContentStore(baseUrl);
  stores.push(store);
  return store;
}

async function prepareDownloadedStore() {
  const fixture = await createProgressiveFixture();
  vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
  const store = await open(fixture.baseUrl);
  const pointer = await store.fetchLatest(new AbortController().signal);
  const manifest = await store.cacheManifest(
    pointer,
    new AbortController().signal,
  );
  const request = {
    jobId: crypto.randomUUID(),
    manifestVersion: pointer.manifest.version,
    chapterIds: ["chapter-01" as const],
    kind: "required" as const,
  };
  await store.download(request, new AbortController().signal, () => undefined);
  return { fixture, store, pointer, manifest, request };
}

beforeEach(async () => {
  cacheStorage = new TestCacheStorage();
  vi.stubGlobal("caches", cacheStorage);
  vi.stubGlobal("location", new URL("https://app.test/play/"));
  await resetProgressiveStorage(cacheStorage);
});

afterEach(async () => {
  for (const store of stores.splice(0)) store.close();
  await resetProgressiveStorage(cacheStorage);
  vi.unstubAllGlobals();
});

describe("ProgressiveContentStore structural storage", () => {
  it("immediate delete-all removes Cache.put-before-IDB quota orphans", async () => {
    const fixture = await createProgressiveFixture();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    const cache = cacheStorage.cache();
    cache.failAfterPut = true;
    const unknown = "https://app.test/unknown";
    cache.entries.set(unknown, new Response("keep"));
    await expect(
      store.download(
        {
          jobId: crypto.randomUUID(),
          manifestVersion: pointer.manifest.version,
          chapterIds: ["chapter-01"],
          kind: "required",
        },
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toMatchObject(error("CONTENT_QUOTA_EXCEEDED"));
    expect(cache.entries.has(cache.failedPutKey!)).toBe(true);
    expect(
      (await progressiveDatabaseSnapshot()).files.some(
        (row) => (row as { cacheKey: string }).cacheKey === cache.failedPutKey,
      ),
    ).toBe(false);
    await store.deleteAllDownloaded();
    expect(cache.entries.has(cache.failedPutKey!)).toBe(false);
    expect([...cache.entries.keys()]).toEqual([unknown]);
  });

  it("cleanup enumerates strict owned orphans, retains unused full-manifest files and noncanonical keys", async () => {
    const { store, pointer, manifest } = await prepareDownloadedStore();
    const cache = cacheStorage.cache();
    const media = manifest.files.find((file) => file.role === "media")!;
    const unused = progressiveFileKey(media.path, media.version);
    const orphan = progressiveFileKey("orphan.json", "a".repeat(64));
    const prefix = orphan.slice(0, orphan.indexOf("a".repeat(64)));
    const unknown = [
      `${orphan}?query=1`,
      `${orphan}#fragment`,
      `${prefix}${"A".repeat(64)}/orphan.json`,
      `${prefix}${"a".repeat(64)}/%6frphan.json`,
      `${prefix}${"a".repeat(64)}/bad//file.json`,
      `${prefix}${"a".repeat(64)}/bad/.hidden/file.json?x`,
      orphan.replace("https://app.test", "https://other.test"),
      "https://app.test/legacy/unknown",
    ];
    for (const key of [unused, orphan, ...unknown])
      cache.entries.set(key, new Response("body"));
    const legacyCache = await cacheStorage.open("ygo-content-staging-v1");
    await legacyCache.put(orphan, new Response("legacy"));
    const db = await openDB(PROGRESSIVE_DATABASE_NAME);
    await db.put(
      "files",
      {
        path: "bad-row.json",
        version: "b".repeat(64),
        bytes: 4,
        cacheKey: unknown[0],
      },
      ["bad-row.json", "b".repeat(64)],
    );
    db.close();
    await store.deleteFilesOutside(pointer.manifest.version);
    expect(cache.entries.has(orphan)).toBe(false);
    expect(cache.entries.has(unused)).toBe(true);
    for (const key of unknown) expect(cache.entries.has(key)).toBe(true);
    expect(await legacyCache.match(orphan)).toBeDefined();
    await store.deleteAllDownloaded();
    expect(cache.entries.has(unused)).toBe(false);
    for (const key of unknown) expect(cache.entries.has(key)).toBe(true);
    expect(await legacyCache.match(orphan)).toBeDefined();
  });

  it.each(["outside", "all"] as const)(
    "%s cleanup reports partial cache deletion failure and retries",
    async (kind) => {
      const { store, pointer } = await prepareDownloadedStore();
      const cache = cacheStorage.cache();
      const keys = ["old-a.json", "old-b.json"].map((path) =>
        progressiveFileKey(path, "a".repeat(64)),
      );
      for (const key of keys) cache.entries.set(key, new Response("orphan"));
      const before = await progressiveDatabaseSnapshot();
      const remove = cache.delete.bind(cache);
      let fail = true;
      vi.spyOn(cache, "delete").mockImplementation(async (key) => {
        if (key === keys[1] && fail) {
          fail = false;
          throw new Error("fixture delete failure");
        }
        return remove(key);
      });
      const cleanup = () =>
        kind === "all"
          ? store.deleteAllDownloaded()
          : store.deleteFilesOutside(pointer.manifest.version);
      await expect(cleanup()).rejects.toMatchObject(
        error("CONTENT_STORAGE_UNAVAILABLE"),
      );
      expect(cache.entries.has(keys[0]!)).toBe(false);
      expect(cache.entries.has(keys[1]!)).toBe(true);
      expect(await progressiveDatabaseSnapshot()).toEqual(before);
      await cleanup();
      expect(cache.entries.has(keys[1]!)).toBe(false);
      expect((await progressiveDatabaseSnapshot()).files).toHaveLength(
        kind === "all" ? 0 : 3,
      );
    },
  );

  it("delete-all reports IDB clear failure after cache deletion and supports retry", async () => {
    const { store } = await prepareDownloadedStore();
    const before = await progressiveDatabaseSnapshot();
    const clear = vi
      .spyOn(IDBObjectStore.prototype, "clear")
      .mockImplementationOnce(function (this: IDBObjectStore) {
        this.transaction.abort();
        throw new DOMException("fixture unavailable", "InvalidStateError");
      });
    await expect(store.deleteAllDownloaded()).rejects.toMatchObject(
      error("CONTENT_STORAGE_UNAVAILABLE"),
    );
    clear.mockRestore();
    expect(cacheStorage.cache().entries.size).toBe(0);
    expect(await progressiveDatabaseSnapshot()).toEqual(before);
    await store.deleteAllDownloaded();
    expect((await progressiveDatabaseSnapshot()).jobs).toEqual([]);
  });

  const corruptions: readonly [string, (row: DownloadJob) => unknown][] = [
    ["null row", () => null],
    ["extra row field", (row) => ({ ...row, extra: true })],
    ["missing request", (row) => ({ progress: row.progress })],
    [
      "extra request field",
      (row) => ({ ...row, request: { ...row.request, extra: true } }),
    ],
    [
      "non-UUID",
      (row) => ({ ...row, request: { ...row.request, jobId: "bad" } }),
    ],
    [
      "different DB key",
      (row) => ({
        ...row,
        request: { ...row.request, jobId: crypto.randomUUID() },
      }),
    ],
    [
      "missing manifest",
      (row) => ({
        ...row,
        request: { ...row.request, manifestVersion: "a".repeat(64) },
      }),
    ],
    [
      "invalid hash",
      (row) => ({
        ...row,
        request: { ...row.request, manifestVersion: "LATEST" },
      }),
    ],
    [
      "unknown chapter",
      (row) => ({
        ...row,
        request: { ...row.request, chapterIds: ["chapter-99"] },
      }),
    ],
    [
      "duplicate chapters",
      (row) => ({
        ...row,
        request: { ...row.request, chapterIds: ["chapter-01", "chapter-01"] },
      }),
    ],
    [
      "invalid kind",
      (row) => ({ ...row, request: { ...row.request, kind: "other" } }),
    ],
    ["missing progress", (row) => ({ request: row.request })],
    [
      "extra progress field",
      (row) => ({ ...row, progress: { ...row.progress, extra: true } }),
    ],
    [
      "wrong progress identity",
      (row) => ({
        ...row,
        progress: { ...row.progress, jobId: crypto.randomUUID() },
      }),
    ],
    [
      "invalid phase",
      (row) => ({ ...row, progress: { ...row.progress, phase: "ready" } }),
    ],
    [
      "negative counter",
      (row) => ({ ...row, progress: { ...row.progress, completedFiles: -1 } }),
    ],
    [
      "fraction counter",
      (row) => ({ ...row, progress: { ...row.progress, completedBytes: 0.5 } }),
    ],
    [
      "unsafe counter",
      (row) => ({
        ...row,
        progress: { ...row.progress, totalBytes: Number.MAX_SAFE_INTEGER + 1 },
      }),
    ],
    [
      "NaN counter",
      (row) => ({ ...row, progress: { ...row.progress, completedBytes: NaN } }),
    ],
    [
      "wrong total",
      (row) => ({
        ...row,
        progress: { ...row.progress, totalFiles: row.progress.totalFiles + 1 },
      }),
    ],
    [
      "above total",
      (row) => ({
        ...row,
        progress: {
          ...row.progress,
          completedBytes: row.progress.totalBytes + 1,
        },
      }),
    ],
    [
      "incomplete complete",
      (row) => ({ ...row, progress: { ...row.progress, completedFiles: 0 } }),
    ],
  ];
  it.each(corruptions)(
    "rejects persisted %s on list/open/resume without changing metadata",
    async (_name, corrupt) => {
      const { store, request, fixture } = await prepareDownloadedStore();
      const row = (await store.listJobs())[0]!;
      const db = await openDB(PROGRESSIVE_DATABASE_NAME);
      await db.put("jobs", corrupt(row), request.jobId);
      db.close();
      const before = await progressiveDatabaseSnapshot();
      const requests = fixture.requests.length;
      await expect(store.listJobs()).rejects.toMatchObject(
        error("CONTENT_INTEGRITY_FAILED"),
      );
      await expect(
        store.download(request, new AbortController().signal, () => undefined),
      ).rejects.toMatchObject(error("CONTENT_INTEGRITY_FAILED"));
      await expect(open(null)).rejects.toMatchObject(
        error("CONTENT_INTEGRITY_FAILED"),
      );
      expect(await progressiveDatabaseSnapshot()).toEqual(before);
      expect(fixture.requests).toHaveLength(requests);
    },
  );

  it("uses only manifests/files/jobs/receipts in ygo-content-files-v1 and never writes active selection", async () => {
    const { store, pointer } = await prepareDownloadedStore();
    const staged = await store.sealRequired(pointer.manifest.version, [
      "chapter-01",
    ]);
    expect(staged).toMatchObject({
      manifestVersion: pointer.manifest.version,
      releaseSequence: 1,
      chapterIds: ["chapter-01"],
    });
    expect(staged.receiptId).toMatch(/^[a-f0-9]{64}$/);

    const snapshot = await progressiveDatabaseSnapshot();
    expect(snapshot.stores).toEqual(["files", "jobs", "manifests", "receipts"]);
    expect(snapshot.files).toHaveLength(3);
    expect(snapshot.receipts).toHaveLength(1);
    expect(snapshot.stores).not.toContain("active");
  });

  it("rejects a receipt-backed corrupted cache body on read, verify, and seal", async () => {
    const { store, pointer } = await prepareDownloadedStore();
    const staged = await store.sealRequired(pointer.manifest.version, [
      "chapter-01",
    ]);
    const cache = cacheStorage.cache();
    const target = [...cache.entries.keys()].find((key) =>
      key.endsWith("/runtime/manifest.json"),
    )!;
    cache.entries.set(target, new Response(new Uint8Array([0])));

    await expect(
      store.readFile(
        pointer.manifest.version,
        "runtime/manifest.json",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject(error("CONTENT_INTEGRITY_FAILED"));
    await expect(
      store.verifyRequired(staged, new AbortController().signal),
    ).rejects.toMatchObject(error("CONTENT_INTEGRITY_FAILED"));
    await expect(
      store.sealRequired(pointer.manifest.version, ["chapter-01"]),
    ).rejects.toMatchObject(error("CONTENT_INTEGRITY_FAILED"));
  });

  it("supports cache-only reads with null baseUrl and does not mutate staged state on latest failure", async () => {
    const { store, pointer } = await prepareDownloadedStore();
    const staged = await store.sealRequired(pointer.manifest.version, [
      "chapter-01",
    ]);
    store.close();
    stores.splice(stores.indexOf(store), 1);
    const before = await progressiveDatabaseSnapshot();
    const offline = await open(null);

    await expect(
      offline.readFile(
        pointer.manifest.version,
        "chapters/chapter-01/gameplay.json",
        new AbortController().signal,
      ),
    ).resolves.toBeInstanceOf(Uint8Array);
    await expect(
      offline.verifyRequired(staged, new AbortController().signal),
    ).resolves.toBeUndefined();
    await expect(
      offline.fetchLatest(new AbortController().signal),
    ).rejects.toMatchObject(error("CONTENT_NETWORK_FAILED"));
    expect(await progressiveDatabaseSnapshot()).toEqual(before);
  });

  it("returns null only for absent local files and rejects malformed membership", async () => {
    const fixture = await createProgressiveFixture();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);

    await expect(
      store.readFile(
        pointer.manifest.version,
        "runtime/manifest.json",
        new AbortController().signal,
      ),
    ).resolves.toBeNull();
    await expect(
      store.readFile(
        pointer.manifest.version,
        "../runtime/manifest.json",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject(error("CONTENT_INVALID_MANIFEST"));
    await expect(
      store.readFile(
        pointer.manifest.version,
        "not-in-manifest.json",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject(error("CONTENT_INVALID_MANIFEST"));
  });

  it("deleteFilesOutside uses the whole manifest allow-set and preserves unknown cache keys", async () => {
    const { store, pointer } = await prepareDownloadedStore();
    const staleKey = progressiveFileKey("stale.json", "a".repeat(64));
    const unknownKey = "https://app.test/legacy/unknown";
    const cache = cacheStorage.cache(PROGRESSIVE_CACHE_NAME);
    cache.entries.set(staleKey, new Response("stale"));
    cache.entries.set(unknownKey, new Response("legacy"));
    const db = await openDB(PROGRESSIVE_DATABASE_NAME);
    await db.put(
      "files",
      {
        path: "stale.json",
        version: "a".repeat(64),
        bytes: 5,
        cacheKey: staleKey,
      },
      ["stale.json", "a".repeat(64)],
    );
    db.close();

    await store.deleteFilesOutside(pointer.manifest.version);

    expect(cache.entries.has(staleKey)).toBe(false);
    expect(cache.entries.has(unknownKey)).toBe(true);
    expect((await progressiveDatabaseSnapshot()).files).toHaveLength(3);
  });

  it("cleanup removes only owned rows/cache keys and preserves legacy DB/cache data", async () => {
    const { store } = await prepareDownloadedStore();
    const legacy = await openDB("ygo-story-content", 1, {
      upgrade(db) {
        db.createObjectStore("active");
      },
    });
    await legacy.put("active", { generation: 7 }, "current");
    legacy.close();
    const cache = cacheStorage.cache(PROGRESSIVE_CACHE_NAME);
    const unknownKey = "https://app.test/legacy/unknown";
    cache.entries.set(unknownKey, new Response("legacy"));

    await store.deleteAllDownloaded();

    const snapshot = await progressiveDatabaseSnapshot();
    expect(snapshot.manifests).toEqual([]);
    expect(snapshot.files).toEqual([]);
    expect(snapshot.jobs).toEqual([]);
    expect(snapshot.receipts).toEqual([]);
    expect(cache.entries.has(unknownKey)).toBe(true);
    const reopenedLegacy = await openDB("ygo-story-content");
    expect(await reopenedLegacy.get("active", "current")).toEqual({
      generation: 7,
    });
    reopenedLegacy.close();
  });

  it("surfaces exact quota errors when Cache.put succeeds before file receipt persistence", async () => {
    const fixture = await createProgressiveFixture();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    const cache = cacheStorage.cache();
    cache.failAfterPut = true;
    const request = {
      jobId: crypto.randomUUID(),
      manifestVersion: pointer.manifest.version,
      chapterIds: ["chapter-01" as const],
      kind: "required" as const,
    };

    await expect(
      store.download(request, new AbortController().signal, () => undefined),
    ).rejects.toMatchObject(error("CONTENT_QUOTA_EXCEEDED"));
    const failedKey = cache.failedPutKey;
    expect(failedKey).not.toBeNull();
    expect(
      (await progressiveDatabaseSnapshot()).files.some(
        (row) => (row as { cacheKey?: unknown }).cacheKey === failedKey,
      ),
    ).toBe(false);

    await store.download(
      request,
      new AbortController().signal,
      () => undefined,
    );
    const fileRequests = fixture.requests.filter((url) =>
      url.includes("/content/files/"),
    );
    expect(fileRequests).toHaveLength(4);
  });

  it("marks persisted running jobs paused only when their browser job lock is free", async () => {
    const { store: initialized, request } = await prepareDownloadedStore();
    const row = (await initialized.listJobs())[0]!;
    initialized.close();
    stores.splice(stores.indexOf(initialized), 1);
    const jobId = request.jobId;
    const db = await openDB(PROGRESSIVE_DATABASE_NAME);
    await db.put(
      "jobs",
      { ...row, progress: { ...row.progress, phase: "running" } },
      jobId,
    );
    db.close();
    const locks = new TestLockManager();
    const release = locks.hold(`ygo-content-download-job-v1:${jobId}`);
    vi.stubGlobal("navigator", { locks });

    const live = await open(null);
    expect((await live.listJobs())[0]?.progress.phase).toBe("running");
    live.close();
    stores.splice(stores.indexOf(live), 1);
    release();
    const interrupted = await open(null);
    expect((await interrupted.listJobs())[0]?.progress.phase).toBe("paused");
  });

  it("keeps DB/cache public names exact", () => {
    expect(PROGRESSIVE_DATABASE_NAME).toBe("ygo-content-files-v1");
    expect(PROGRESSIVE_CACHE_NAME).toBe("ygo-content-files-v1");
  });
});
