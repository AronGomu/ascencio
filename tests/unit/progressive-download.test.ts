import "fake-indexeddb/auto";
import { openDB } from "idb";
import { progressiveFileKey } from "../../src/content/storage/content-cache.ts";
import type { openProgressiveContentDatabase } from "../../src/content/storage/content-database.ts";
import { canonicalBytes } from "../../scripts/lib/asset-delivery/canonical-json.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openProgressiveContentStore,
  parseLatestContentPointer,
  parseProgressiveManifest,
  type ContentError,
  type DownloadProgress,
  type ProgressiveContentStore,
  type ProgressiveManifest,
  type ReleaseFile,
} from "../../src/content/index.ts";
import { sha } from "../fixtures/content-install-fixture.ts";
import {
  createProgressiveFixture,
  type ProgressiveFixture,
} from "../fixtures/progressive-release.ts";
import {
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

function json(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function fixtureWithExtraRuntimeFiles(
  count: number,
): Promise<ProgressiveFixture> {
  const fixture = await createProgressiveFixture();
  const objects = fixture.objects as Map<string, Uint8Array>;
  const pointer = parseLatestContentPointer(
    json(objects.get("content/latest.json")!),
  );
  const oldKey = `content/manifests/${pointer.manifest.version}.json`;
  const manifest = parseProgressiveManifest(json(objects.get(oldKey)!));
  const extra: ReleaseFile[] = [];
  for (let index = 0; index < count; index++) {
    const bytes = new TextEncoder().encode(`runtime-${index}\n`);
    const version = sha(bytes);
    const path = `runtime/extra-${String(index).padStart(2, "0")}.json`;
    extra.push({
      path,
      version,
      bytes: bytes.length,
      mediaType: "application/json",
      role: "runtime",
      required: true,
      packIds: ["runtime"],
    });
    objects.set(`content/files/${version}/${path}`, bytes);
  }
  const next: ProgressiveManifest = parseProgressiveManifest({
    ...manifest,
    files: [...manifest.files, ...extra].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  });
  const manifestBytes = canonicalBytes(next);
  const version = sha(manifestBytes);
  objects.delete(oldKey);
  objects.set(`content/manifests/${version}.json`, manifestBytes);
  objects.set(
    "content/latest.json",
    canonicalBytes({
      schemaVersion: 1,
      releaseSequence: next.releaseSequence,
      manifest: { version, bytes: manifestBytes.length },
    }),
  );
  return fixture;
}

async function fixtureWithDependentChapter(): Promise<ProgressiveFixture> {
  const fixture = await createProgressiveFixture();
  const objects = fixture.objects as Map<string, Uint8Array>;
  const pointer = parseLatestContentPointer(
    json(objects.get("content/latest.json")!),
  );
  const oldKey = `content/manifests/${pointer.manifest.version}.json`;
  const manifest = parseProgressiveManifest(json(objects.get(oldKey)!));
  const paths = [
    ["chapters/chapter-02/gameplay.json", "gameplay"],
    ["chapters/chapter-02/story.json", "story"],
  ] as const;
  const files = [...manifest.files];
  for (const [path, role] of paths) {
    const bytes = canonicalBytes({ chapterId: "chapter-02", fixture: role });
    const version = sha(bytes);
    files.push({
      path,
      version,
      bytes: bytes.length,
      mediaType: "application/json",
      role,
      required: true,
      packIds: ["chapter-02"],
    });
    objects.set(`content/files/${version}/${path}`, bytes);
  }
  const next = parseProgressiveManifest({
    ...manifest,
    chapters: [
      ...manifest.chapters,
      {
        id: "chapter-02",
        title: "Dependent chapter",
        description: "Depends on chapter 1",
        depends: ["chapter-01"],
        gameplayPath: "chapters/chapter-02/gameplay.json",
        storyPath: "chapters/chapter-02/story.json",
      },
    ],
    files: files.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  });
  const manifestBytes = canonicalBytes(next);
  const version = sha(manifestBytes);
  objects.delete(oldKey);
  objects.set(`content/manifests/${version}.json`, manifestBytes);
  objects.set(
    "content/latest.json",
    canonicalBytes({
      schemaVersion: 1,
      releaseSequence: next.releaseSequence,
      manifest: { version, bytes: manifestBytes.length },
    }),
  );
  return fixture;
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

describe("progressive download jobs", () => {
  it("completes under Shell-held exclusive download lock without reacquisition", async () => {
    const locks = new TestLockManager();
    vi.stubGlobal("navigator", { locks });
    const fixture = await createProgressiveFixture();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    await expect(
      locks.request("ygo-content-download-v1", { mode: "exclusive" }, () =>
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
      ),
    ).resolves.toBeUndefined();
    expect((await store.listJobs())[0]?.progress.phase).toBe("complete");
    expect(
      locks.requests.filter((name) => name === "ygo-content-download-v1"),
    ).toHaveLength(1);
  });

  it("excludes the same job across store instances while preserving the live running row", async () => {
    const locks = new TestLockManager();
    vi.stubGlobal("navigator", { locks });
    const fixture = await createProgressiveFixture();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const first = await open(fixture.baseUrl);
    const second = await open(fixture.baseUrl);
    const pointer = await first.fetchLatest(new AbortController().signal);
    await first.cacheManifest(pointer, new AbortController().signal);
    const request = {
      jobId: crypto.randomUUID(),
      manifestVersion: pointer.manifest.version,
      chapterIds: ["chapter-01" as const],
      kind: "required" as const,
    };
    const reached = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const cache = cacheStorage.cache();
    const put = cache.put.bind(cache);
    vi.spyOn(cache, "put").mockImplementation(async (...args) => {
      await put(...args);
      reached.resolve();
      await release.promise;
    });
    const running = first.download(
      request,
      new AbortController().signal,
      () => undefined,
    );
    try {
      await reached.promise;
      await expect(
        second.download(request, new AbortController().signal, () => undefined),
      ).rejects.toMatchObject(error("CONTENT_JOB_CONFLICT"));
      const reopened = await open(fixture.baseUrl);
      expect((await reopened.listJobs())[0]?.progress.phase).toBe("running");
    } finally {
      release.resolve();
      await running;
    }
    await second.download(
      request,
      new AbortController().signal,
      () => undefined,
    );
    expect(
      fixture.requests.filter((url) => url.includes("/content/files/")),
    ).toHaveLength(3);
  });

  it.each(["cache", "file-row", "progress", "complete"] as const)(
    "persists paused on abort during last %s write",
    async (boundary) => {
      const fixture = await createProgressiveFixture();
      vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
      const store = await open(fixture.baseUrl);
      const pointer = await store.fetchLatest(new AbortController().signal);
      const manifest = await store.cacheManifest(
        pointer,
        new AbortController().signal,
      );
      const total = manifest.files.filter((file) => file.required).length;
      const reached = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const wait = async () => {
        reached.resolve();
        await release.promise;
      };
      let writes = 0;
      if (boundary === "cache") {
        const cache = cacheStorage.cache();
        const put = cache.put.bind(cache);
        vi.spyOn(cache, "put").mockImplementation(async (...args) => {
          await put(...args);
          if (++writes === total) await wait();
        });
      } else {
        const db = (
          store as unknown as {
            db: Awaited<ReturnType<typeof openProgressiveContentDatabase>>;
          }
        ).db;
        const put = db.put.bind(db);
        vi.spyOn(db, "put").mockImplementation(async (...args) => {
          const [name, row] = args;
          if (boundary === "file-row" && name === "files" && ++writes === total)
            await wait();
          if (
            name === "jobs" &&
            "progress" in row &&
            ((boundary === "progress" &&
              row.progress.phase === "running" &&
              row.progress.completedFiles === total) ||
              (boundary === "complete" && row.progress.phase === "complete"))
          )
            await wait();
          return put(...args);
        });
      }
      const controller = new AbortController();
      const progress: DownloadProgress[] = [];
      const running = store.download(
        {
          jobId: crypto.randomUUID(),
          manifestVersion: pointer.manifest.version,
          chapterIds: ["chapter-01"],
          kind: "required",
        },
        controller.signal,
        (value) => progress.push(value),
      );
      const rejected = expect(running).rejects.toMatchObject(
        error("CONTENT_CANCELLED"),
      );
      await reached.promise;
      controller.abort();
      release.resolve();
      await rejected;
      expect((await store.listJobs())[0]?.progress.phase).toBe("paused");
      expect(progress.some((value) => value.phase === "complete")).toBe(false);
      store.close();
      stores.splice(stores.indexOf(store), 1);
      expect((await (await open(null)).listJobs())[0]?.progress.phase).toBe(
        "paused",
      );
    },
  );

  it.each([
    { name: "non-closed", chapterIds: ["chapter-02"] },
    { name: "unsorted", chapterIds: ["chapter-02", "chapter-01"] },
  ])("rejects $name persisted chapter identity", async ({ chapterIds }) => {
    const fixture = await fixtureWithDependentChapter();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    const request = {
      jobId: crypto.randomUUID(),
      manifestVersion: pointer.manifest.version,
      chapterIds: ["chapter-02" as const],
      kind: "required" as const,
    };
    await store.download(
      request,
      new AbortController().signal,
      () => undefined,
    );
    const db = await openDB(PROGRESSIVE_DATABASE_NAME);
    const row = await db.get("jobs", request.jobId);
    row.request.chapterIds = chapterIds;
    await db.put("jobs", row, request.jobId);
    db.close();
    await expect(store.listJobs()).rejects.toMatchObject(
      error("CONTENT_INTEGRITY_FAILED"),
    );
    await expect(
      store.download(request, new AbortController().signal, () => undefined),
    ).rejects.toMatchObject(error("CONTENT_INTEGRITY_FAILED"));
    await expect(open(null)).rejects.toMatchObject(
      error("CONTENT_INTEGRITY_FAILED"),
    );
  });

  it("Progressive resume: skips verified files and restarts an interrupted file wholly only after explicit resume", async () => {
    const initial = await createProgressiveFixture();
    const attempts = new Map<string, number>();
    const controller = new AbortController();
    let interrupted = false;
    vi.stubGlobal(
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (!url.includes("/content/files/")) return initial.fetch(input, init);
        attempts.set(url, (attempts.get(url) ?? 0) + 1);
        if (
          url.endsWith("/chapters/chapter-01/gameplay.json") &&
          !interrupted
        ) {
          interrupted = true;
          const key = url.slice(initial.baseUrl.length);
          const bytes = initial.objects.get(key)!;
          const stream = new ReadableStream<Uint8Array>({
            start(streamController) {
              streamController.enqueue(bytes.slice(0, 1));
              setTimeout(() => controller.abort(), 20);
              init?.signal?.addEventListener(
                "abort",
                () =>
                  streamController.error(
                    new DOMException("aborted", "AbortError"),
                  ),
                { once: true },
              );
            },
          });
          return new Response(stream, {
            headers: { "Content-Length": String(bytes.length) },
          });
        }
        return initial.fetch(input, init);
      },
    );
    const store = await open(initial.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    const request = {
      jobId: crypto.randomUUID(),
      manifestVersion: pointer.manifest.version,
      chapterIds: ["chapter-01" as const],
      kind: "required" as const,
    };

    await expect(
      store.download(request, controller.signal, () => undefined),
    ).rejects.toMatchObject(error("CONTENT_CANCELLED"));
    expect((await store.listJobs())[0]?.progress.phase).toBe("paused");
    const completedBeforeResume = (await progressiveDatabaseSnapshot()).files;
    expect(completedBeforeResume.length).toBeGreaterThan(0);
    expect(completedBeforeResume.length).toBeLessThan(3);

    await store.download(
      request,
      new AbortController().signal,
      () => undefined,
    );

    const counts = [...attempts.entries()].map(([url, count]) => ({
      url,
      count,
    }));
    expect(
      counts.find(({ url }) =>
        url.endsWith("/chapters/chapter-01/gameplay.json"),
      )?.count,
    ).toBe(2);
    expect(counts.filter(({ count }) => count === 1)).toHaveLength(
      completedBeforeResume.length,
    );
    expect((await store.listJobs())[0]?.progress.phase).toBe("complete");
  });

  it("Persisted job identity: keeps original closed request after latest advances and rejects mismatched resume", async () => {
    const first = await createProgressiveFixture({ releaseSequence: 1 });
    vi.stubGlobal("fetch", first.fetch.bind(first));
    const store = await open(first.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    const request = {
      jobId: crypto.randomUUID(),
      manifestVersion: pointer.manifest.version,
      chapterIds: ["chapter-01" as const],
      kind: "required" as const,
    };
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      store.download(request, aborted.signal, () => undefined),
    ).rejects.toMatchObject(error("CONTENT_CANCELLED"));
    store.close();
    stores.splice(stores.indexOf(store), 1);

    const advanced = await createProgressiveFixture({ releaseSequence: 2 });
    vi.stubGlobal("fetch", advanced.fetch.bind(advanced));
    const resumed = await open(advanced.baseUrl);
    const latest = await resumed.fetchLatest(new AbortController().signal);
    expect(latest.manifest.version).not.toBe(pointer.manifest.version);
    const jobs = await resumed.listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.request).toEqual(request);
    expect(jobs[0]?.progress.phase).toBe("paused");
    expect(Object.isFrozen(jobs[0])).toBe(true);
    expect(Object.isFrozen(jobs[0]?.request.chapterIds)).toBe(true);

    await expect(
      resumed.download(
        { ...request, kind: "media" },
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toMatchObject(error("CONTENT_JOB_CONFLICT"));
    await resumed.download(
      jobs[0]!.request,
      new AbortController().signal,
      () => undefined,
    );
    expect(
      advanced.requests.some((url) => url.includes(pointer.manifest.version)),
    ).toBe(false);
  });

  it("cleanup retains unused required chapters from the full manifest allow-set without file rows", async () => {
    const fixture = await fixtureWithDependentChapter();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    const manifest = await store.cacheManifest(
      pointer,
      new AbortController().signal,
    );
    await store.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: pointer.manifest.version,
        chapterIds: ["chapter-01"],
        kind: "required",
      },
      new AbortController().signal,
      () => undefined,
    );
    const unused = manifest.files.filter((file) =>
      file.packIds.includes("chapter-02"),
    );
    expect(unused).toHaveLength(2);
    const cache = cacheStorage.cache();
    for (const file of unused) {
      const bytes = fixture.objects.get(
        `content/files/${file.version}/${file.path}`,
      )!;
      await cache.put(
        progressiveFileKey(file.path, file.version),
        new Response(bytes.slice()),
      );
    }
    const stale = progressiveFileKey("old.json", "a".repeat(64));
    await cache.put(stale, new Response("old"));
    await store.deleteFilesOutside(pointer.manifest.version);
    expect(cache.entries.has(stale)).toBe(false);
    for (const file of unused)
      expect(
        cache.entries.has(progressiveFileKey(file.path, file.version)),
      ).toBe(true);
    expect((await progressiveDatabaseSnapshot()).files).toHaveLength(3);
    expect(fixture.requests.some((url) => url.includes("/chapter-02/"))).toBe(
      false,
    );
  });

  it("normalizes each request to its sorted dependency-closed chapter identity", async () => {
    const fixture = await fixtureWithDependentChapter();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    const request = {
      jobId: crypto.randomUUID(),
      manifestVersion: pointer.manifest.version,
      chapterIds: ["chapter-02" as const],
      kind: "required" as const,
    };

    await store.download(
      request,
      new AbortController().signal,
      () => undefined,
    );

    expect((await store.listJobs())[0]?.request.chapterIds).toEqual([
      "chapter-01",
      "chapter-02",
    ]);
    const staged = await store.sealRequired(pointer.manifest.version, [
      "chapter-02",
    ]);
    expect(staged.chapterIds).toEqual(["chapter-01", "chapter-02"]);
    await expect(
      store.verifyRequired(staged, new AbortController().signal),
    ).resolves.toBeUndefined();
    expect((await progressiveDatabaseSnapshot()).files).toHaveLength(5);
  });

  it("Version reuse: downloads shared path+version once across two manifests", async () => {
    const first = await createProgressiveFixture({ releaseSequence: 1 });
    vi.stubGlobal("fetch", first.fetch.bind(first));
    const store = await open(first.baseUrl);
    const firstPointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(firstPointer, new AbortController().signal);
    await store.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: firstPointer.manifest.version,
        chapterIds: ["chapter-01"],
        kind: "required",
      },
      new AbortController().signal,
      () => undefined,
    );

    const second = await createProgressiveFixture({ releaseSequence: 2 });
    vi.stubGlobal("fetch", second.fetch.bind(second));
    const secondPointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(secondPointer, new AbortController().signal);
    await store.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: secondPointer.manifest.version,
        chapterIds: ["chapter-01"],
        kind: "required",
      },
      new AbortController().signal,
      () => undefined,
    );

    expect(
      second.requests.filter((url) => url.includes("/content/files/")),
    ).toEqual([]);
    const jobs = await store.listJobs();
    expect(jobs.map((job) => job.request.jobId)).toEqual(
      jobs.map((job) => job.request.jobId).toSorted(),
    );
    expect((await progressiveDatabaseSnapshot()).files).toHaveLength(3);
  });

  it("Required-only: seals without optional media and performs zero media GETs", async () => {
    const fixture = await createProgressiveFixture({ optionalMedia: true });
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    const progress: DownloadProgress[] = [];
    await store.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: pointer.manifest.version,
        chapterIds: ["chapter-01"],
        kind: "required",
      },
      new AbortController().signal,
      (value) => progress.push(value),
    );
    await expect(
      store.sealRequired(pointer.manifest.version, ["chapter-01"]),
    ).resolves.toMatchObject({ chapterIds: ["chapter-01"] });

    expect(
      fixture.requests.some((url) => url.endsWith("/images/card.svg")),
    ).toBe(false);
    expect(progress.at(-1)).toMatchObject({
      phase: "complete",
      completedFiles: 3,
      totalFiles: 3,
    });
    expect(progress.at(-1)?.completedBytes).toBe(progress.at(-1)?.totalBytes);
  });

  it("bounds network file concurrency at four and uses credentials omit plus redirect error", async () => {
    const fixture = await fixtureWithExtraRuntimeFiles(6);
    const locks = new TestLockManager();
    vi.stubGlobal("navigator", { locks });
    let active = 0;
    let maximum = 0;
    const inits: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/content/files/")) {
          active++;
          maximum = Math.max(maximum, active);
          inits.push(init ?? {});
          await new Promise((resolve) => setTimeout(resolve, 10));
          const response = await fixture.fetch(input, init);
          active--;
          return response;
        }
        return fixture.fetch(input, init);
      },
    );
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    await store.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: pointer.manifest.version,
        chapterIds: ["chapter-01"],
        kind: "required",
      },
      new AbortController().signal,
      () => undefined,
    );

    expect(maximum).toBe(4);
    expect(inits).not.toHaveLength(0);
    expect(inits.every((init) => init.credentials === "omit")).toBe(true);
    expect(inits.every((init) => init.redirect === "error")).toBe(true);
    expect(locks.requests).toEqual([
      expect.stringMatching(/^ygo-content-download-job-v1:/),
    ]);
  });

  it("cancels an oversized manifest response instead of downloading the remaining body", async () => {
    const fixture = await createProgressiveFixture();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(pointer.manifest.bytes + 1));
            },
            cancel,
          }),
        ),
    );

    await expect(
      store.cacheManifest(pointer, new AbortController().signal),
    ).rejects.toMatchObject(error("CONTENT_INTEGRITY_FAILED"));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects non-UUID job IDs before network or persistence", async () => {
    const fixture = await createProgressiveFixture();
    vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
    const store = await open(fixture.baseUrl);
    const pointer = await store.fetchLatest(new AbortController().signal);
    await store.cacheManifest(pointer, new AbortController().signal);
    const before = fixture.requests.length;

    await expect(
      store.download(
        {
          jobId: "not-a-uuid",
          manifestVersion: pointer.manifest.version,
          chapterIds: ["chapter-01"],
          kind: "required",
        },
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toMatchObject(error("CONTENT_INVALID_MANIFEST"));
    expect(fixture.requests).toHaveLength(before);
    expect(await store.listJobs()).toEqual([]);
  });
});
