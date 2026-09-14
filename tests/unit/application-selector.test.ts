// @vitest-environment node
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApplicationSelector } from "../../src/shell/application/application-selector.ts";
import {
  acquireDomainSession,
  withContentDownloadLock,
} from "../../src/shell/application/application-locks.ts";
import { createStoryMigrationPort } from "../../src/story/saves/index.ts";
import {
  storyReleaseFixture,
  storyBindingFixture,
} from "../fixtures/story-release.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import type { PreparedRelease } from "../../src/shell/application/prepared-release.ts";
import type { ProgressiveContentStore } from "../../src/content/index.ts";
import { testLocks } from "../fixtures/application-locks.ts";

afterEach(() => vi.restoreAllMocks());
const signal = () => new AbortController().signal;
function fixture() {
  const factory = new IDBFactory();
  const locks = testLocks();
  const saves = createStoryMigrationPort(factory);
  const prepared = {
    content: {
      receiptId: "a".repeat(64),
      manifestVersion: "b".repeat(64),
      releaseSequence: 1,
      chapterIds: ["chapter-01"],
    },
    story: storyReleaseFixture(),
  } as unknown as PreparedRelease;
  const store = {
    readManifest: vi.fn(async () => ({
      releaseSequence: 1,
      coreRange: { min: 1, maxExclusive: 2 },
    })),
    verifyRequired: vi.fn(async () => undefined),
  } as unknown as ProgressiveContentStore;
  const notify = vi.fn();
  const selector = createApplicationSelector({
    factory,
    locks,
    store,
    coreContentApiVersion: 1,
    notify,
  });
  return { factory, locks, saves, prepared, store, selector, notify };
}

describe("Application selection", () => {
  it("Crash matrix: before save tx / after seal / after selector tx", async () => {
    const f = fixture();
    const old = await f.selector.read();
    const prepare = vi
      .spyOn(f.saves, "prepare")
      .mockRejectedValueOnce(new Error("STORY_STORAGE_QUOTA"));
    expect(await f.selector.activate(0, f.prepared, f.saves, signal())).toEqual(
      { kind: "failed", code: "APP_SAVE_MIGRATION_FAILED" },
    );
    expect(await f.selector.read()).toEqual(old);
    prepare.mockRestore();
    vi.spyOn(f.saves, "verifySeal").mockRejectedValueOnce(
      new Error("STORY_MIGRATION_FAILED"),
    );
    expect(
      (await f.selector.activate(0, f.prepared, f.saves, signal())).kind,
    ).toBe("failed");
    expect(await f.selector.read()).toEqual(old);
    const result = await f.selector.activate(0, f.prepared, f.saves, signal());
    expect(result.kind).toBe("activated");
    if (result.kind !== "activated") throw new Error("not activated");
    expect(await f.selector.read()).toEqual(result.selection);
    await expect(
      f.saves.verifyActiveGeneration(
        result.selection.storyGenerationId!,
        f.prepared.story,
      ),
    ).resolves.toBeUndefined();
  });
  it("Concurrent selection: stale expectedGeneration", async () => {
    const f = fixture();
    await f.selector.activate(0, f.prepared, f.saves, signal());
    const before = await f.selector.read();
    expect(await f.selector.activate(0, f.prepared, f.saves, signal())).toEqual(
      { kind: "blocked", code: "APP_ACTIVATION_CONFLICT" },
    );
    expect(await f.selector.read()).toEqual(before);
  });
  it("Two tabs: shared domain lease blocks immediately; no queued later commit", async () => {
    const f = fixture();
    const session = await acquireDomainSession(signal(), {
      locks: f.locks,
      selector: f.selector,
    });
    expect(await f.selector.activate(0, f.prepared, f.saves, signal())).toEqual(
      { kind: "blocked", code: "APP_SESSION_ACTIVE" },
    );
    session.release();
    session.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await f.selector.read()).generation).toBe(0);
    expect(
      (await f.selector.activate(0, f.prepared, f.saves, signal())).kind,
    ).toBe("activated");
  });
  it("download lock blocks activation without queue", async () => {
    const f = fixture();
    const held = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const download = withContentDownloadLock(f.locks, async () => {
      entered.resolve();
      await held.promise;
    });
    await entered.promise;
    expect(await f.selector.activate(0, f.prepared, f.saves, signal())).toEqual(
      { kind: "blocked", code: "APP_DOWNLOAD_ACTIVE" },
    );
    held.resolve();
    await download;
    expect((await f.selector.read()).generation).toBe(0);
  });
  it("notification throw after commit remains activated", async () => {
    const f = fixture();
    f.notify.mockImplementation(() => {
      throw new Error("observer crash");
    });
    expect(
      (await f.selector.activate(0, f.prepared, f.saves, signal())).kind,
    ).toBe("activated");
    expect((await f.selector.read()).generation).toBe(1);
  });
  it("Save after activation: normal save/clear followed by offline reopen", async () => {
    const f = fixture();
    await f.selector.activate(0, f.prepared, f.saves, signal());
    const selection = await f.selector.read();
    const repo = f.saves.repository(selection.storyGenerationId!);
    expect(
      await repo.write(
        "manual:1",
        createInitialStoryState(),
        null,
        storyBindingFixture(),
      ),
    ).toEqual({ kind: "written", revision: 1 });
    await repo.clear("autosave");
    const reopened = createStoryMigrationPort(f.factory);
    await expect(
      reopened.verifyActiveGeneration(
        selection.storyGenerationId!,
        f.prepared.story,
      ),
    ).resolves.toBeUndefined();
    expect(
      (await reopened.repository(selection.storyGenerationId!).read("manual:1"))
        .kind,
    ).toBe("ready");
  });
  it("unknown selector row refuses instead of defaulting", async () => {
    const f = fixture();
    await f.selector.read();
    const req = f.factory.open("ygo-application-state", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("selection", "readwrite");
      tx.objectStore("selection").put({ schemaVersion: 99 }, "active");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    await expect(f.selector.read()).rejects.toThrow("APP_STORAGE_UNAVAILABLE");
  });
});

it("Quota migration: failure copying one of five slots preserves selector and all old hashes", async () => {
  const f = fixture();
  await f.selector.activate(0, f.prepared, f.saves, signal());
  const before = await f.selector.read();
  const repo = f.saves.repository(before.storyGenerationId!);
  const slots = [
    "manual:1",
    "manual:2",
    "manual:3",
    "autosave",
    "checkpoint:pre-duel",
  ] as const;
  for (const slot of slots)
    await repo.write(
      slot,
      { ...createInitialStoryState(), dp: 123 },
      null,
      storyBindingFixture(),
    );
  const hashes = await Promise.all(
    slots.map(async (slot) => JSON.stringify(await repo.read(slot))),
  );
  const put = IDBObjectStore.prototype.put;
  let copies = 0;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if (this.name === "generationSaves" && ++copies === 3)
      throw new DOMException("full", "QuotaExceededError");
    return put.apply(this, args);
  });
  expect(
    await f.selector.activate(
      1,
      { ...f.prepared, story: storyReleaseFixture(2) },
      f.saves,
      signal(),
    ),
  ).toEqual({ kind: "failed", code: "APP_SAVE_MIGRATION_FAILED" });
  expect(await f.selector.read()).toEqual(before);
  expect(
    await Promise.all(
      slots.map(async (slot) => JSON.stringify(await repo.read(slot))),
    ),
  ).toEqual(hashes);
});

it("selector transaction CAS catches noncooperating concurrent write after seal", async () => {
  const f = fixture();
  let checks = 0;
  vi.mocked(f.store.verifyRequired).mockImplementation(async () => {
    if (++checks !== 2) return;
    const { selectionTransaction } =
      await import("../../src/shell/application/application-state.ts");
    const seal = await f.saves.prepare(null, f.prepared.story);
    await selectionTransaction(f.factory, {
      schemaVersion: 1,
      generation: 1,
      content: f.prepared.content,
      storyGenerationId: seal.generationId,
    });
  });
  expect(await f.selector.activate(0, f.prepared, f.saves, signal())).toEqual({
    kind: "blocked",
    code: "APP_ACTIVATION_CONFLICT",
  });
  expect((await f.selector.read()).generation).toBe(1);
});

it("aborted activation after seal leaves old pair; leases released", async () => {
  const f = fixture();
  const controller = new AbortController();
  const verify = f.saves.verifySeal;
  vi.spyOn(f.saves, "verifySeal").mockImplementation(async (seal) => {
    await verify(seal);
    controller.abort();
  });
  expect(
    (await f.selector.activate(0, f.prepared, f.saves, controller.signal)).kind,
  ).toBe("failed");
  expect((await f.selector.read()).generation).toBe(0);
  const session = await acquireDomainSession(signal(), {
    locks: f.locks,
    selector: f.selector,
  });
  session.release();
});

it("selector parser rejects sparse chapter selection", async () => {
  const { parseApplicationSelection } =
    await import("../../src/shell/application/application-state.ts");
  const f = fixture();
  expect(() =>
    parseApplicationSelection({
      schemaVersion: 1,
      generation: 1,
      content: { ...f.prepared.content, chapterIds: Array(1) },
      storyGenerationId: "fixture",
    }),
  ).toThrow("APP_STORAGE_UNAVAILABLE");
});

it.each(["CONTENT_STORAGE_UNAVAILABLE", "STORY_STORAGE_UNAVAILABLE"])(
  "%s is classified as application storage failure",
  async (code) => {
    const f = fixture();
    if (code.startsWith("CONTENT"))
      vi.mocked(f.store.verifyRequired).mockRejectedValueOnce(new Error(code));
    else vi.spyOn(f.saves, "prepare").mockRejectedValueOnce(new Error(code));
    expect(await f.selector.activate(0, f.prepared, f.saves, signal())).toEqual(
      { kind: "failed", code: "APP_STORAGE_UNAVAILABLE" },
    );
    expect((await f.selector.read()).generation).toBe(0);
  },
);
