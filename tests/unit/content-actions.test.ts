// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProgressiveContentStore,
  ProgressiveManifest,
} from "../../src/content/index.ts";
import { createApplicationService } from "../../src/shell/application/application-service.ts";
import type { PreparedRelease } from "../../src/shell/application/prepared-release.ts";
import { createContentActions } from "../../src/shell/application/content-actions.ts";
import {
  selectionTransaction,
  type ApplicationSelection,
} from "../../src/shell/application/application-state.ts";
import type { StoryGenerationId } from "../../src/story/saves/index.ts";
import { testLocks } from "../fixtures/application-locks.ts";

const manifest: ProgressiveManifest = {
  schemaVersion: 3,
  releaseSequence: 1,
  coreRange: { min: 1, maxExclusive: 3 },
  runtimeSnapshotId: "a".repeat(64),
  chapters: [
    {
      id: "chapter-01",
      title: "Fixture",
      description: "Fixture",
      depends: [],
      gameplayPath: "gameplay.json",
      storyPath: "story.json",
    },
  ],
  files: [
    {
      path: "image.svg",
      version: "b".repeat(64),
      bytes: 10,
      mediaType: "image/svg+xml",
      role: "media",
      required: false,
      packIds: ["chapter-01"],
    },
  ],
};

function store() {
  return {
    readManifest: vi.fn(async () => manifest),
    readFile: vi.fn<ProgressiveContentStore["readFile"]>(async () => null),
    verifyRequired: vi.fn(async () => undefined),
    fetchLatest: vi.fn(async () => ({
      schemaVersion: 1 as const,
      releaseSequence: 1,
      manifest: { version: "c".repeat(64), bytes: 10 },
    })),
    cacheManifest: vi.fn(async () => manifest),
    download: vi.fn(async (_request, _signal, progress) => {
      progress({
        jobId: _request.jobId,
        phase: "complete",
        completedFiles: 1,
        totalFiles: 1,
        completedBytes: 10,
        totalBytes: 10,
      });
    }),
    sealRequired: vi.fn(),
    listJobs: vi.fn(async () => []),
    deleteFilesOutside: vi.fn(async () => undefined),
    deleteAllDownloaded: vi.fn(async () => undefined),
    close: vi.fn(),
  } satisfies ProgressiveContentStore;
}

async function active(factory: IDBFactory): Promise<ApplicationSelection> {
  const selected: ApplicationSelection = {
    schemaVersion: 1,
    generation: 1,
    content: {
      receiptId: "d".repeat(64),
      manifestVersion: "e".repeat(64),
      releaseSequence: 1,
      chapterIds: ["chapter-01"],
    },
    storyGenerationId: "story-generation-1" as StoryGenerationId,
  };
  await selectionTransaction(factory, selected);
  return selected;
}

function fixture(
  factory: IDBFactory,
  contentStore = store(),
  overrides: Partial<Parameters<typeof createContentActions>[0]> = {},
) {
  const selector = {
    read: () => selectionTransaction(factory).then((v) => v!),
  };
  const update = vi.fn(async () => undefined);
  const actions = createContentActions({
    factory,
    locks: testLocks(),
    store: contentStore,
    selector: selector as never,
    activate: vi.fn(),
    isHome: () => true,
    coreBaseUrl: "https://app.test/",
    currentBuildId: "build-a",
    fetch: vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            buildId: "build-b",
            coreContentApiVersion: 2,
          }),
        ),
    ),
    requestServiceWorkerUpdate: update,
    now: () => 123,
    ...overrides,
  });
  return { actions, contentStore, update };
}

beforeEach(() => vi.restoreAllMocks());

describe("ContentActions", () => {
  it("Independent consent: CORE approval downloads no content payload", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const f = fixture(factory);
    await f.actions.approveCore({
      schemaVersion: 1,
      buildId: "build-b",
      coreContentApiVersion: 2,
    });
    expect(f.update).toHaveBeenCalledOnce();
    expect(f.contentStore.download).not.toHaveBeenCalled();
  });

  it("Discovery failure retains existing offline selection", async () => {
    const factory = new IDBFactory();
    const selected = await active(factory);
    const contentStore = store();
    vi.mocked(contentStore.fetchLatest).mockRejectedValue(
      new Error("CONTENT_NETWORK_FAILED"),
    );
    const actions = createContentActions({
      factory,
      locks: testLocks(),
      store: contentStore,
      selector: {
        read: () => selectionTransaction(factory).then((value) => value!),
      } as never,
      activate: vi.fn(),
      isHome: () => true,
      coreBaseUrl: "https://app.test/",
      currentBuildId: "build-a",
      fetch: vi.fn(async () => {
        throw new Error("offline");
      }),
      requestServiceWorkerUpdate: vi.fn(),
    });
    await expect(
      actions.check(new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(await selectionTransaction(factory)).toEqual(selected);
    expect(actions.view).toMatchObject({
      phase: "failed",
      message:
        "Update check failed. Installed offline content remains available.",
    });
  });

  it("Approved incompatible: CORE approval is rejected while old play stays selected", async () => {
    const factory = new IDBFactory();
    const selected = await active(factory);
    const contentStore = store();
    vi.mocked(contentStore.readManifest).mockResolvedValue({
      ...manifest,
      coreRange: { min: 1, maxExclusive: 2 },
    });
    const f = fixture(factory, contentStore);
    await expect(
      f.actions.approveCore({
        schemaVersion: 1,
        buildId: "build-b",
        coreContentApiVersion: 2,
      }),
    ).rejects.toThrow("CORE_CONTENT_INCOMPATIBLE");
    expect(await selectionTransaction(factory)).toEqual(selected);
    expect(f.update).not.toHaveBeenCalled();
  });

  it("Independent consent: media download requests media only", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const f = fixture(factory);
    await f.actions.downloadMedia(new AbortController().signal);
    expect(f.contentStore.download).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "media", chapterIds: ["chapter-01"] }),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(f.update).not.toHaveBeenCalled();
  });

  it("Delete all: clears only selected content and preserves Story generation", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const f = fixture(factory);
    await f.actions.deleteAllAssets();
    expect(f.contentStore.deleteAllDownloaded).toHaveBeenCalledOnce();
    await expect(selectionTransaction(factory)).resolves.toEqual({
      schemaVersion: 1,
      generation: 2,
      content: null,
      storyGenerationId: "story-generation-1",
    });
    expect(f.actions.view.message).toBe(
      "Downloaded assets deleted. Saves and settings were retained.",
    );
  });

  it("Partial delete fail: remains visible and retryable", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const contentStore = store();
    vi.mocked(contentStore.deleteFilesOutside)
      .mockRejectedValueOnce(new Error("CONTENT_STORAGE_UNAVAILABLE"))
      .mockResolvedValueOnce(undefined);
    const f = fixture(factory, contentStore);
    await expect(f.actions.deleteUnusedAssets()).rejects.toThrow(
      "CONTENT_STORAGE_UNAVAILABLE",
    );
    expect(f.actions.view.phase).toBe("failed");
    await expect(f.actions.deleteUnusedAssets()).resolves.toBeUndefined();
    expect(f.actions.view.phase).toBe("ready");
  });

  it("Download crash/cleanup: live download lock blocks immediately", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const locks = testLocks();
    const held = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const running = locks.request(
      "ygo-content-download-v1",
      { mode: "exclusive" },
      async () => {
        entered.resolve();
        await held.promise;
      },
    );
    await entered.promise;
    const contentStore = store();
    const actions = createContentActions({
      factory,
      locks,
      store: contentStore,
      selector: {
        read: () => selectionTransaction(factory).then((value) => value!),
      } as never,
      activate: vi.fn(),
      isHome: () => true,
      coreBaseUrl: "https://app.test/",
      currentBuildId: "build-a",
      requestServiceWorkerUpdate: vi.fn(),
    });
    await expect(actions.deleteUnusedAssets()).rejects.toThrow(
      "APP_DOWNLOAD_ACTIVE",
    );
    expect(contentStore.deleteFilesOutside).not.toHaveBeenCalled();
    held.resolve();
    await running;
  });

  it("No active manifest blocks Delete unused without wildcard cleanup", async () => {
    const factory = new IDBFactory();
    await selectionTransaction(factory);
    const f = fixture(factory);
    await expect(f.actions.deleteUnusedAssets()).rejects.toThrow(
      "CONTENT_MISSING",
    );
    expect(f.contentStore.deleteFilesOutside).not.toHaveBeenCalled();
  });
});

describe("T10 repair", () => {
  const signal = () => new AbortController().signal;
  const candidate = {
    schemaVersion: 1,
    buildId: "build-b",
    coreContentApiVersion: 2,
  };

  it.each([undefined, "1"])(
    "CORE stream cancels overflow with Content-Length %s before reading remainder",
    async (length) => {
      const factory = new IDBFactory();
      await active(factory);
      const cancel = vi.fn();
      const pull = vi.fn(
        (controller: ReadableStreamDefaultController<Uint8Array>) => {
          controller.enqueue(new Uint8Array(1024));
          if (pull.mock.calls.length === 20) controller.close();
        },
      );
      const body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
      const f = fixture(factory, store(), {
        fetch: vi.fn(
          async () =>
            new Response(body, {
              headers: length === undefined ? {} : { "Content-Length": length },
            }),
        ),
      });
      await f.actions.check(signal());
      expect(cancel).toHaveBeenCalledOnce();
      expect(pull).toHaveBeenCalledTimes(5);
      expect(f.actions.view).toMatchObject({
        phase: "failed",
        canApproveCore: false,
      });
      expect(f.actions.view.message).toContain("CORE update check failed");
      f.actions.dispose();
    },
  );

  it("CORE stream accepts exact 4096-byte metadata", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const text = JSON.stringify(candidate).padEnd(4096, " ");
    const f = fixture(factory, store(), {
      fetch: vi.fn(async () => new Response(text)),
    });
    await f.actions.check(signal());
    expect(f.actions.view).toMatchObject({
      coreCandidate: candidate,
      canApproveCore: true,
    });
    f.actions.dispose();
  });

  it.each(["content", "CORE"])(
    "partial %s discovery failure keeps other channel actionable plus offline pair",
    async (channel) => {
      const factory = new IDBFactory();
      const selected = await active(factory);
      const contentStore = store();
      contentStore.fetchLatest.mockResolvedValue({
        schemaVersion: 1,
        releaseSequence: 2,
        manifest: { version: "c".repeat(64), bytes: 10 },
      });
      if (channel === "content")
        contentStore.fetchLatest.mockRejectedValue(
          new Error("CONTENT_NETWORK_FAILED"),
        );
      const f = fixture(factory, contentStore, {
        fetch: vi.fn(async () => {
          if (channel === "CORE") throw new Error("offline");
          return new Response(JSON.stringify(candidate));
        }),
      });
      await f.actions.check(signal());
      expect(f.actions.view).toMatchObject({
        phase: "failed",
        canInstall: channel === "CORE",
        canApproveCore: channel === "content",
      });
      expect(f.actions.view.message).toContain(
        channel === "content"
          ? "Content update check failed"
          : "CORE update check failed",
      );
      expect(await selectionTransaction(factory)).toEqual(selected);
      expect(contentStore.download).not.toHaveBeenCalled();
      f.actions.dispose();
    },
  );

  it("failed content discovery never reports up to date when CORE is current", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const contentStore = store();
    contentStore.fetchLatest.mockRejectedValue(
      new Error("CONTENT_NETWORK_FAILED"),
    );
    const f = fixture(factory, contentStore, {
      fetch: vi.fn(
        async () =>
          new Response(JSON.stringify({ ...candidate, buildId: "build-a" })),
      ),
    });
    await f.actions.check(signal());
    expect(f.actions.view.phase).toBe("failed");
    expect(f.actions.view.message).toContain("Content update check failed");
    f.actions.dispose();
  });

  it("delayed check vs Delete all cannot republish stale candidates/actions", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const delayed = Promise.withResolvers<Response>();
    const f = fixture(factory, store(), {
      fetch: vi.fn(() => delayed.promise),
    });
    const checking = f.actions.check(signal());
    await vi.waitFor(() =>
      expect(f.contentStore.fetchLatest).toHaveBeenCalled(),
    );
    await f.actions.deleteAllAssets();
    const deleted = f.actions.view;
    delayed.resolve(new Response(JSON.stringify(candidate)));
    await checking;
    expect(await selectionTransaction(factory)).toMatchObject({
      generation: 2,
      content: null,
    });
    expect(f.actions.view).toEqual(deleted);
    await expect(f.actions.installRequired(signal())).rejects.toThrow(
      "CONTENT_NETWORK_FAILED",
    );
    f.actions.dispose();
  });

  it("check computes install availability from final current selector, not pre-discovery generation", async () => {
    const factory = new IDBFactory();
    const selected = await active(factory);
    const delayed = Promise.withResolvers<Response>();
    const f = fixture(factory, store(), {
      fetch: vi.fn(() => delayed.promise),
    });
    const checking = f.actions.check(signal());
    await vi.waitFor(() =>
      expect(f.contentStore.fetchLatest).toHaveBeenCalled(),
    );
    await selectionTransaction(factory, {
      ...selected,
      generation: 2,
      content: null,
    });
    delayed.resolve(new Response(JSON.stringify(candidate)));
    await checking;
    expect(f.actions.view).toMatchObject({
      canInstall: true,
      missingMedia: 0,
      canDownloadMedia: false,
    });
    f.actions.dispose();
  });

  it("selected chapter media count equals media batch including runtime/shared files, excluding other chapters", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const contentStore = store();
    contentStore.readManifest.mockResolvedValue({
      ...manifest,
      chapters: [
        ...manifest.chapters,
        { ...manifest.chapters[0]!, id: "chapter-02" },
      ],
      files: [
        ...manifest.files,
        { ...manifest.files[0]!, path: "runtime.png", packIds: ["runtime"] },
        {
          ...manifest.files[0]!,
          path: "shared.png",
          packIds: ["chapter-01", "chapter-02"],
        },
        { ...manifest.files[0]!, path: "other.png", packIds: ["chapter-02"] },
      ],
    });
    const f = fixture(factory, contentStore);
    await f.actions.check(signal());
    expect(f.actions.view.missingMedia).toBe(3);
    contentStore.download.mockImplementation(async (request) => {
      expect(request.chapterIds).toEqual(["chapter-01"]);
      contentStore.readFile.mockImplementation(async (_version, path) =>
        path === "other.png" ? null : new Uint8Array([1]),
      );
    });
    await f.actions.downloadMedia(signal());
    expect(f.actions.view).toMatchObject({
      missingMedia: 0,
      canDownloadMedia: false,
    });
    expect(
      contentStore.readFile.mock.calls.every((call) => call[1] !== "other.png"),
    ).toBe(true);
    f.actions.dispose();
  });

  it("broadcast refreshes ContentActionsView cache-only; delayed old media read never overrides new selection", async () => {
    const factory = new IDBFactory();
    const selected = await active(factory);
    const contentStore = store();
    const delayed = Promise.withResolvers<null>();
    contentStore.readFile.mockImplementationOnce(() => delayed.promise);
    const service = createApplicationService({
      factory,
      locks: testLocks(),
      store: contentStore,
      coreContentApiVersion: 1,
      isHome: () => true,
    });
    const sender = new BroadcastChannel("ygo-application-state-v1");
    try {
      await vi.waitFor(() =>
        expect(contentStore.readFile).toHaveBeenCalledOnce(),
      );
      await selectionTransaction(factory, {
        ...selected,
        generation: 2,
        content: null,
      });
      const listener = vi.fn();
      service.application.subscribe(listener);
      sender.postMessage("changed");
      await vi.waitFor(() => expect(listener).toHaveBeenCalled());
      delayed.resolve(null);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(service.contentActions.view).toMatchObject({
        missingMedia: 0,
        canDownloadMedia: false,
        canActivate: false,
      });
      expect(contentStore.fetchLatest).not.toHaveBeenCalled();
      expect(contentStore.cacheManifest).not.toHaveBeenCalled();
      expect(contentStore.download).not.toHaveBeenCalled();
    } finally {
      sender.close();
      service.application.close();
    }
  });

  it("superseded async preparation is disposed, never publishes activation", async () => {
    const factory = new IDBFactory();
    const selected = await active(factory);
    const contentStore = store();
    contentStore.sealRequired.mockResolvedValue(selected.content!);
    const delayed = Promise.withResolvers<PreparedRelease>();
    const prepare = vi.fn(() => delayed.promise);
    const f = fixture(factory, contentStore, { prepare });
    await f.actions.check(signal());
    const installing = f.actions.installRequired(signal());
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    const next = f.actions.check(signal());
    await next;
    const dispose = vi.fn();
    delayed.resolve({
      content: selected.content,
      dispose,
    } as unknown as PreparedRelease);
    await installing;
    expect(f.actions.view.canActivate).toBe(false);
    expect(dispose).toHaveBeenCalledOnce();
    f.actions.dispose();
  });
  it("media completion broadcasts local changes without another discovery", async () => {
    const factory = new IDBFactory();
    await active(factory);
    const changed = vi.fn();
    const f = fixture(factory, store(), { changed });
    await f.actions.downloadMedia(signal());
    expect(changed).toHaveBeenCalledOnce();
    expect(f.contentStore.fetchLatest).not.toHaveBeenCalled();
    f.actions.dispose();
  });

  it("superseded download progress and completion never replace refreshed selected generation", async () => {
    const factory = new IDBFactory();
    const selected = await active(factory);
    const delayed = Promise.withResolvers<void>();
    const contentStore = store();
    contentStore.download.mockImplementation(
      async (_request, _signal, progress) => {
        await delayed.promise;
        progress({
          jobId: "old",
          phase: "complete",
          completedFiles: 1,
          totalFiles: 1,
          completedBytes: 99,
          totalBytes: 99,
        });
      },
    );
    const f = fixture(factory, contentStore);
    const downloading = f.actions.downloadMedia(signal());
    await vi.waitFor(() =>
      expect(contentStore.download).toHaveBeenCalledOnce(),
    );
    await selectionTransaction(factory, {
      ...selected,
      generation: 2,
      content: null,
    });
    await f.actions.refresh();
    const refreshed = f.actions.view;
    delayed.resolve();
    await downloading;
    expect(f.actions.view).toEqual(refreshed);
    expect(f.actions.view).toMatchObject({
      missingMedia: 0,
      canDownloadMedia: false,
    });
    f.actions.dispose();
  });

  it("partial Delete all failure clears staged activation and remains retryable", async () => {
    const factory = new IDBFactory();
    const selected = await active(factory);
    const contentStore = store();
    const dispose = vi.fn();
    contentStore.sealRequired.mockResolvedValue(selected.content!);
    contentStore.deleteAllDownloaded.mockRejectedValueOnce(
      new Error("CONTENT_STORAGE_UNAVAILABLE"),
    );
    const f = fixture(factory, contentStore, {
      prepare: vi.fn(
        async () =>
          ({
            content: selected.content,
            dispose,
          }) as unknown as PreparedRelease,
      ),
    });
    await f.actions.check(signal());
    await f.actions.installRequired(signal());
    expect(f.actions.view.canActivate).toBe(true);
    await expect(f.actions.deleteAllAssets()).rejects.toThrow(
      "CONTENT_STORAGE_UNAVAILABLE",
    );
    expect(f.actions.view).toMatchObject({
      phase: "failed",
      canActivate: false,
      canDownloadMedia: false,
      canDeleteAssets: true,
      missingMedia: 0,
    });
    expect(dispose).toHaveBeenCalledOnce();
    await expect(selectionTransaction(factory)).resolves.toMatchObject({
      generation: 2,
      content: null,
      storyGenerationId: selected.storyGenerationId,
    });
    await f.actions.deleteAllAssets();
    expect(f.actions.view.phase).toBe("ready");
    f.actions.dispose();
  });
  it("prepared current candidate keeps Install disabled through local refresh and repeated check", async () => {
    const factory = new IDBFactory();
    const selected = await active(factory);
    const contentStore = store();
    const staged = {
      ...selected.content!,
      manifestVersion: "c".repeat(64),
      releaseSequence: 2,
    };
    contentStore.fetchLatest.mockResolvedValue({
      schemaVersion: 1,
      releaseSequence: 2,
      manifest: { version: staged.manifestVersion, bytes: 10 },
    });
    contentStore.sealRequired.mockResolvedValue(staged);
    const f = fixture(factory, contentStore, {
      prepare: vi.fn(
        async () =>
          ({ content: staged, dispose: vi.fn() }) as unknown as PreparedRelease,
      ),
    });
    await f.actions.check(signal());
    expect(f.actions.view.canInstall).toBe(true);
    await f.actions.installRequired(signal());
    expect(f.actions.view).toMatchObject({
      canInstall: false,
      canActivate: true,
    });
    await f.actions.check(signal());
    expect(f.actions.view).toMatchObject({
      canInstall: false,
      canActivate: true,
    });
    f.actions.dispose();
  });
});
