import { IDBFactory } from "fake-indexeddb";
import { createApplicationAdmission } from "../../../src/shell/application/application-admission.ts";
import { createAppUpdateController } from "../../../src/shell/application/app-update-controller.ts";
import { readCoreApproval } from "../../../src/shell/application/core-update-approval.ts";
import { testLocks } from "../../fixtures/application-locks.ts";
import { describe, expect, it, vi } from "vitest";
import type {
  FreeplayInputs,
  StoryInputs,
} from "../../../src/shell/core/shell-application.ts";
import type { ShellUserServices } from "../../../src/shell/core/user-services.ts";
import { createSqliteApplicationService } from "../../../src/shell/application/sqlite-application-service.ts";
import type {
  ActivePackage,
  LocalStorageClient,
  MediaWarning,
  PackageId,
  PackageStack,
  StorageResult,
} from "../../../src/storage/index.ts";

function active(packageId: PackageId): ActivePackage {
  return {
    schemaVersion: 1,
    packageId,
    packageType: packageId.startsWith("chapter-") ? "chapter" : packageId,
    version: "1.0.0",
    dependencies: [],
    createdAt: "2026-09-24T00:00:00.000Z",
    fileKey: `${packageId}.sqlite`,
    bytes: 1,
    sha256: "a".repeat(64),
  } as ActivePackage;
}

function stack(
  generation = 7,
  packageIds: readonly PackageId[] = ["duel-core", "card-library", "freeplay"],
): PackageStack {
  return {
    generation,
    packages: packageIds.map(active),
  };
}

function ok<T>(value: T): StorageResult<T> {
  return { kind: "ok", value };
}

function inputs(snapshotId = "runtime-identity"): FreeplayInputs {
  return {
    users: users(),
    cards: {} as FreeplayInputs["cards"],
    collectionSets: [],
    images: {} as FreeplayInputs["images"],
    battle: {} as FreeplayInputs["battle"],
    presentation: { snapshotId } as FreeplayInputs["presentation"],
    editor: {} as FreeplayInputs["editor"],
  };
}

function storyInputs(): StoryInputs {
  const gameplay = {} as StoryInputs["gameplay"];
  return {
    users: users(),
    gameplay,
    cards: {} as StoryInputs["cards"],
    release: {} as StoryInputs["release"],
    media: {} as StoryInputs["media"],
    saves: {} as StoryInputs["saves"],
  };
}

function users(): ShellUserServices {
  return {
    preferences: {} as ShellUserServices["preferences"],
    createDeckRepository: vi.fn() as ShellUserServices["createDeckRepository"],
  };
}

function harness(initial = stack()) {
  const events: string[] = [];
  const warnings = new Set<(warning: MediaWarning) => void>();
  let session = 0;
  const releases: Array<ReturnType<typeof vi.fn>> = [];
  const storage = {
    packages: {
      current: vi.fn(async () => {
        events.push("current");
        return ok(initial);
      }),
      acquireSession: vi.fn(async () => {
        const release = vi.fn(async () => {
          events.push(`release:${sessionId}`);
        });
        releases.push(release);
        const sessionId = ++session;
        events.push(`lease:${sessionId}`);
        return ok({ generation: initial.generation, release });
      }),
    },
    content: {},
    userData: {},
    subscribeMediaWarnings: vi.fn(
      (listener: (warning: MediaWarning) => void) => {
        warnings.add(listener);
        return () => warnings.delete(listener);
      },
    ),
    close: vi.fn(),
  } as unknown as LocalStorageClient;
  return {
    storage,
    events,
    releases,
    warn(warning: MediaWarning) {
      for (const listener of warnings) listener(warning);
    },
    warningListeners: warnings,
  };
}

describe("SQLite Shell application composition", () => {
  it("leases before readiness and semantic input load; publishes lease generation and runtime identity", async () => {
    const f = harness();
    const loaded = inputs("0123456789abcdef");
    const load = vi.fn(async () => {
      f.events.push("load");
      return loaded;
    });
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ok(undefined),
      loadFreeplayInputs: load,
      closeFreeplayInputs: () => f.events.push("inputs:close"),
    });

    const readiness = await service.readiness();
    expect(readiness).toMatchObject({
      generation: 7,
      freeplay: true,
      deckBuilder: true,
      missing: ["chapter-01"],
    });
    f.events.length = 0;

    const session = await service.application.acquire(
      "freeplay",
      new AbortController().signal,
    );
    expect(f.events).toEqual(["lease:1", "current", "load"]);
    expect(session).toMatchObject({
      kind: "freeplay",
      generation: 7,
      inputs: { presentation: { snapshotId: "0123456789abcdef" } },
    });
    expect(service.sessionActive()).toBe(true);
    await session.close();
    expect(service.sessionActive()).toBe(false);
    expect(f.events.slice(-2)).toEqual(["inputs:close", "release:1"]);
    await service.dispose();
  });

  it.each([
    {
      name: "zero packages",
      installed: [] as readonly PackageId[],
      expected: "APP_CONTENT_REQUIRED:duel-core,card-library,freeplay",
    },
    {
      name: "partial stack",
      installed: ["card-library"] as readonly PackageId[],
      expected: "APP_CONTENT_REQUIRED:duel-core,freeplay",
    },
  ])(
    "reports exact ordered first-three gaps for $name without loading inputs",
    async ({ installed, expected }) => {
      const f = harness(stack(3, installed));
      const load = vi.fn();
      const service = createSqliteApplicationService({
        storage: f.storage,
        users: users(),
        flushUserWrites: async () => ok(undefined),
        loadFreeplayInputs: load,
      });

      await expect(
        service.application.acquire("freeplay", new AbortController().signal),
      ).rejects.toThrow(expected);
      expect(load).not.toHaveBeenCalled();
      expect(f.releases[0]).toHaveBeenCalledOnce();
      await service.dispose();
    },
  );

  it("leases Story before generation/readiness/input load and closes writes, inputs, lease in order", async () => {
    const f = harness(
      stack(7, ["duel-core", "card-library", "freeplay", "chapter-01"]),
    );
    const loaded = storyInputs();
    const loadStory = vi.fn(async (_storage, _users, chapterId) => {
      f.events.push(`story:load:${chapterId}`);
      return loaded;
    });
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => {
        f.events.push("writes:flush");
        return ok(undefined);
      },
      loadStoryInputs: loadStory,
      closeStoryInputs: () => f.events.push("story:inputs:close"),
    });

    const session = await service.application.acquire(
      "story",
      new AbortController().signal,
    );
    expect(f.events).toEqual(["lease:1", "current", "story:load:chapter-01"]);
    expect(session).toMatchObject({
      kind: "story",
      generation: 7,
      inputs: loaded,
    });
    await session.close();
    expect(f.events.slice(-3)).toEqual([
      "writes:flush",
      "story:inputs:close",
      "release:1",
    ]);
    await service.dispose();
  });

  it("rejects Story missing ordered prerequisites after releasing its lease", async () => {
    const f = harness(stack(3, ["card-library", "chapter-01"]));
    const loadStory = vi.fn();
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ok(undefined),
      loadStoryInputs: loadStory,
    });

    await expect(
      service.application.acquire("story", new AbortController().signal),
    ).rejects.toThrow("APP_CONTENT_REQUIRED:duel-core,freeplay");
    expect(loadStory).not.toHaveBeenCalled();
    expect(f.releases[0]).toHaveBeenCalledOnce();
    await service.dispose();
  });

  it("releases a lease when semantic input loading fails", async () => {
    const f = harness();
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ok(undefined),
      loadFreeplayInputs: async () => {
        throw new Error("APP_REQUIRED_INPUT_FAILED");
      },
    });

    await expect(
      service.application.acquire("freeplay", new AbortController().signal),
    ).rejects.toThrow("APP_REQUIRED_INPUT_FAILED");
    expect(f.releases[0]).toHaveBeenCalledOnce();
    await service.dispose();
  });

  it("releases failed and aborted overlapping acquires without publishing stale inputs", async () => {
    const f = harness();
    const first = Promise.withResolvers<FreeplayInputs>();
    const second = Promise.withResolvers<FreeplayInputs>();
    const load = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const closed: FreeplayInputs[] = [];
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ok(undefined),
      loadFreeplayInputs: load,
      closeFreeplayInputs: (value) => closed.push(value),
    });
    const firstAbort = new AbortController();
    const firstAcquire = service.application.acquire(
      "freeplay",
      firstAbort.signal,
    );
    const secondAcquire = service.application.acquire(
      "freeplay",
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    firstAbort.abort();
    const stale = inputs("stale");
    const current = inputs("current");
    first.resolve(stale);
    second.resolve(current);

    await expect(firstAcquire).rejects.toMatchObject({ name: "AbortError" });
    const session = await secondAcquire;
    expect(session.inputs).toBe(current);
    expect(closed).toEqual([stale]);
    expect(f.releases[0]).toHaveBeenCalledOnce();
    await session.close();
    await session.close();
    expect(f.releases[1]).toHaveBeenCalledOnce();
    await service.dispose();
  });

  it("retains first Story close failure while attempting input close and lease release", async () => {
    const f = harness(
      stack(7, ["duel-core", "card-library", "freeplay", "chapter-01"]),
    );
    const closeStory = vi.fn(() => {
      throw new Error("STORY_INPUT_CLOSE_FAILED");
    });
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ({
        kind: "failed",
        error: { code: "STORAGE_QUOTA_EXCEEDED" },
      }),
      loadStoryInputs: async () => storyInputs(),
      closeStoryInputs: closeStory,
    });
    const session = await service.application.acquire(
      "story",
      new AbortController().signal,
    );
    f.releases[0]!.mockRejectedValueOnce(new Error("LEASE_RELEASE_FAILED"));

    await expect(session.close()).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
    expect(closeStory).toHaveBeenCalledOnce();
    expect(f.releases[0]).toHaveBeenCalledOnce();
    await expect(service.dispose()).resolves.toBeUndefined();
  });

  it("surfaces pending write failure while still closing inputs before lease release", async () => {
    const f = harness();
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ({
        kind: "failed",
        error: { code: "STORAGE_QUOTA_EXCEEDED" },
      }),
      loadFreeplayInputs: async () => inputs(),
      closeFreeplayInputs: () => f.events.push("inputs:close"),
    });
    const session = await service.application.acquire(
      "freeplay",
      new AbortController().signal,
    );

    await expect(session.close()).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
    expect(f.events.slice(-2)).toEqual(["inputs:close", "release:1"]);
    await expect(session.close()).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
    expect(f.releases[0]).toHaveBeenCalledOnce();
    await service.dispose();
  });

  it("retains exact optional-media warnings across readiness refresh and unsubscribes once", async () => {
    const f = harness();
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ok(undefined),
      loadFreeplayInputs: async () => inputs(),
    });
    expect(f.storage.subscribeMediaWarnings).toHaveBeenCalledOnce();
    f.warn({
      packageId: "card-library",
      path: "cards/full/7.jpg",
      reason: "missing",
    });
    await service.readiness();
    f.warn({ packageId: "freeplay", path: "cover.webp", reason: "corrupt" });

    expect(service.status.warnings).toEqual([
      {
        packageId: "card-library",
        path: "cards/full/7.jpg",
        reason: "missing",
      },
      { packageId: "freeplay", path: "cover.webp", reason: "corrupt" },
    ]);
    await service.dispose();
    expect(f.warningListeners.size).toBe(0);
  });

  it("root disposal waits for pending session writes before storage may close", async () => {
    const f = harness();
    const flush = Promise.withResolvers<StorageResult<void>>();
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: () => flush.promise,
      loadFreeplayInputs: async () => inputs(),
      closeFreeplayInputs: () => f.events.push("inputs:close"),
    });
    const session = await service.application.acquire(
      "freeplay",
      new AbortController().signal,
    );
    const closing = session.close();
    const disposed = service.dispose();
    let settled = false;
    void disposed.finally(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(f.releases[0]).not.toHaveBeenCalled();

    flush.resolve(ok(undefined));
    await closing;
    await disposed;
    expect(f.events.slice(-2)).toEqual(["inputs:close", "release:1"]);
    expect(f.storage.close).not.toHaveBeenCalled();
  });

  it("root disposal aborts pending startup and releases its lease before settling", async () => {
    const f = harness();
    const pending = Promise.withResolvers<FreeplayInputs>();
    const service = createSqliteApplicationService({
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ok(undefined),
      loadFreeplayInputs: () => pending.promise,
      closeFreeplayInputs: () => f.events.push("inputs:close"),
    });
    const acquiring = service.application.acquire(
      "freeplay",
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(f.releases).toHaveLength(1));
    service.application.close();
    pending.resolve(inputs());

    await expect(acquiring).rejects.toMatchObject({ name: "AbortError" });
    await service.dispose();
    expect(f.events.slice(-2)).toEqual(["inputs:close", "release:1"]);
  });
});

describe("root update and session admission", () => {
  it("rejects session after prepare starts; precommit cancel immediately restores navigation without orphan lock", async () => {
    const admission = createApplicationAdmission();
    const f = harness();
    const service = createSqliteApplicationService({
      admission,
      storage: f.storage,
      users: users(),
      flushUserWrites: async () => ok(undefined),
      loadFreeplayInputs: async () => inputs(),
      closeFreeplayInputs: () => undefined,
    });
    const entered = Promise.withResolvers<void>();
    const prepared = Promise.withResolvers<() => Promise<void>>();
    const update = vi.fn(async () => undefined);
    const factory = new IDBFactory();
    const locks = testLocks();
    const candidate = {
      schemaVersion: 1,
      buildId: "build-b",
      coreContentApiVersion: 1,
    } as const;
    const updater = createAppUpdateController({
      admission,
      factory,
      locks,
      currentBuildId: "build-a",
      appBaseUrl: "https://app.test/",
      fetch: async () => new Response(JSON.stringify(candidate)),
      isSessionActive: () => service.sessionActive(),
      prepareServiceWorkerUpdate: async () => {
        entered.resolve();
        return prepared.promise;
      },
    });
    await updater.check();
    const approving = updater.approve(candidate);
    await entered.promise;
    await expect(
      service.application.acquire("freeplay", new AbortController().signal),
    ).rejects.toThrow("APP_SESSION_ACTIVE");
    expect(f.storage.packages.acquireSession).not.toHaveBeenCalled();
    updater.cancel();
    const acquiring = service.application.acquire(
      "freeplay",
      new AbortController().signal,
    );
    await approving;
    const session = await acquiring;
    await locks.request(
      "ygo-application-lifecycle-v1",
      { mode: "exclusive", ifAvailable: true },
      (lock) => {
        expect(lock).not.toBeNull();
      },
    );
    prepared.resolve(update);
    await Promise.resolve();
    expect(await readCoreApproval(factory)).toBeNull();
    expect(update).not.toHaveBeenCalled();
    await session.close();
    await updater.dispose();
    await service.dispose();
  });

  it("session gate spans acquisition, active inputs, flush, failed close; rejected acquire releases gate", async () => {
    const admission = createApplicationAdmission();
    const f = harness();
    const loaded = Promise.withResolvers<FreeplayInputs>();
    const flushing = Promise.withResolvers<StorageResult<void>>();
    const service = createSqliteApplicationService({
      admission,
      storage: f.storage,
      users: users(),
      flushUserWrites: () => flushing.promise,
      loadFreeplayInputs: () => loaded.promise,
      closeFreeplayInputs: () => undefined,
    });
    const started = service.application.acquire(
      "freeplay",
      new AbortController().signal,
    );
    expect(admission.enter("approval")).toBeNull();
    expect(admission.enter("restore")).toBeNull();
    loaded.resolve(inputs());
    const session = await started;
    expect(admission.enter("approval")).toBeNull();
    const closing = session.close();
    expect(admission.enter("approval")).toBeNull();
    flushing.resolve({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    await expect(closing).rejects.toThrow("STORAGE_UNAVAILABLE");
    const released = admission.enter("approval");
    expect(released).not.toBeNull();
    released!();
    const abort = new AbortController();
    abort.abort();
    await expect(
      service.application.acquire("freeplay", abort.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    const afterFailure = admission.enter("approval");
    expect(afterFailure).not.toBeNull();
    afterFailure!();
    await service.dispose();
  });
});
