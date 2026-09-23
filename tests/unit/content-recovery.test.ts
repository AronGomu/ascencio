import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openProgressiveContentStore,
  type ProgressiveContentStore,
} from "../../src/content/index.ts";
import { progressiveFileKey } from "../../src/content/storage/content-cache.ts";
import {
  createContentActions,
  type ContentActionsController,
} from "../../src/shell/application/content-actions.ts";
import {
  selectionTransaction,
  type ApplicationSelection,
} from "../../src/shell/application/application-state.ts";
import type { PreparedRelease } from "../../src/shell/application/prepared-release.ts";
import type { StoryGenerationId } from "../../src/story/saves/index.ts";
import { createProgressiveFixture } from "../fixtures/progressive-release.ts";
import {
  TestCacheStorage,
  PROGRESSIVE_DATABASE_NAME,
  resetProgressiveStorage,
  progressiveDatabaseSnapshot,
} from "../fixtures/progressive-storage.ts";
import { testLocks } from "../fixtures/application-locks.ts";

let cache: TestCacheStorage;
const stores: ProgressiveContentStore[] = [];
const actions: ContentActionsController[] = [];
const signal = () => new AbortController().signal;
beforeEach(async () => {
  cache = new TestCacheStorage();
  vi.stubGlobal("caches", cache);
  vi.stubGlobal("location", new URL("https://app.test/"));
  await resetProgressiveStorage(cache);
});
afterEach(async () => {
  for (const controller of actions.splice(0)) controller.dispose();
  for (const store of stores.splice(0)) store.close();
  await resetProgressiveStorage(cache);
  vi.unstubAllGlobals();
});
async function setup() {
  const fixture = await createProgressiveFixture();
  vi.stubGlobal("fetch", fixture.fetch.bind(fixture));
  const store = await openProgressiveContentStore(fixture.baseUrl);
  stores.push(store);
  const pointer = await store.fetchLatest(signal());
  const manifest = await store.cacheManifest(pointer, signal());
  for (const kind of ["required", "media"] as const)
    await store.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: pointer.manifest.version,
        chapterIds: ["chapter-01"],
        kind,
      },
      signal(),
      () => undefined,
    );
  const content = await store.sealRequired(pointer.manifest.version, [
    "chapter-01",
  ]);
  const factory = new IDBFactory();
  const selected: ApplicationSelection = {
    schemaVersion: 1,
    generation: 1,
    content,
    storyGenerationId: "saved-generation" as StoryGenerationId,
  };
  await selectionTransaction(factory, selected);
  const selector = { read: async () => (await selectionTransaction(factory))! };
  const activate = vi.fn();
  const changed = vi.fn();
  const controller = createContentActions({
    factory,
    locks: testLocks(),
    store,
    selector: selector as never,
    activate,
    changed,
    isHome: () => true,
    currentBuildId: "build-a",
    coreBaseUrl: "https://app.test/",
    fetch: async () =>
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          buildId: "build-a",
          coreContentApiVersion: 1,
        }),
      ),
    requestServiceWorkerUpdate: vi.fn(),
    // Wire fixture tests storage and selection, not semantic gameplay preparation.
    prepare: async (_store, content) =>
      ({ content, dispose: vi.fn() }) as unknown as PreparedRelease,
  });
  actions.push(controller);
  await controller.refresh();
  return {
    fixture,
    store,
    manifest,
    factory,
    selected,
    controller,
    activate,
    changed,
  };
}

describe("explicit content recovery", () => {
  it.each(["evicted", "corrupt"])(
    "repairs only %s required bytes; retains media, selector and saves",
    async (fault) => {
      const f = await setup();
      const required = f.manifest.files.find((file) => file.required)!;
      const key = progressiveFileKey(required.path, required.version);
      if (fault === "evicted") cache.cache().entries.delete(key);
      else cache.cache().entries.set(key, new Response("corrupt"));
      const filesBefore = [...cache.cache().entries.keys()]
        .filter((entry) => entry !== key)
        .sort();
      const requestCount = f.fixture.requests.length;
      await f.controller.check(signal());
      expect(f.controller.view.canInstall).toBe(true);
      expect(
        f.fixture.requests
          .slice(requestCount)
          .every((url) => !url.includes("/content/files/")),
      ).toBe(true);
      const discoveryCount = f.fixture.requests.length;
      await f.controller.installRequired(signal());
      expect(f.fixture.requests.slice(discoveryCount)).toEqual([
        `${f.fixture.baseUrl}content/files/${required.version}/${required.path}`,
      ]);
      expect(
        [...cache.cache().entries.keys()]
          .filter((entry) => entry !== key)
          .sort(),
      ).toEqual(filesBefore);
      await expect(
        f.store.verifyRequired(f.selected.content!, signal()),
      ).resolves.toBeUndefined();
      expect(await selectionTransaction(f.factory)).toEqual(f.selected);
      expect(f.activate).not.toHaveBeenCalled();
      expect(f.controller.view).toMatchObject({
        canInstall: false,
        canActivate: false,
      });
    },
  );

  it("healthy current release survives missing historical manifest; explicit cleanup retains save generation", async () => {
    const f = await setup();
    const db = await openDB(PROGRESSIVE_DATABASE_NAME);
    const prior = (await f.store.listJobs())[0]!;
    const jobId = crypto.randomUUID();
    const corrupt = {
      ...prior,
      request: { ...prior.request, jobId, manifestVersion: "a".repeat(64) },
      progress: { ...prior.progress, jobId },
    };
    await db.put("jobs", corrupt, jobId);
    db.close();
    const before = await progressiveDatabaseSnapshot();
    const reopened = await openProgressiveContentStore(null);
    stores.push(reopened);
    await expect(
      reopened.verifyRequired(f.selected.content!, signal()),
    ).resolves.toBeUndefined();
    await expect(reopened.listJobs()).rejects.toThrow(
      "CONTENT_INTEGRITY_FAILED",
    );
    await expect(f.controller.refresh()).rejects.toThrow(
      "CONTENT_INTEGRITY_FAILED",
    );
    expect(await progressiveDatabaseSnapshot()).toEqual(before);
    expect(f.controller.view).toMatchObject({
      phase: "failed",
      canDeleteAssets: true,
    });
    await f.controller.deleteAllAssets();
    expect(await selectionTransaction(f.factory)).toMatchObject({
      generation: 2,
      content: null,
      storyGenerationId: f.selected.storyGenerationId,
    });
    expect((await progressiveDatabaseSnapshot()).jobs).toEqual([]);
  });
});
