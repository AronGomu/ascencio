import type { ShellDomainSession } from "../../src/shell/core/shell-application.ts";
// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { createApplicationReadiness } from "../../src/shell/application/application-readiness.ts";
import { createApplicationSelector } from "../../src/shell/application/application-selector.ts";
import { createStoryMigrationPort } from "../../src/story/saves/index.ts";
import {
  storyReleaseFixture,
  storyBindingFixture,
} from "../fixtures/story-release.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import type { PreparedRelease } from "../../src/shell/application/prepared-release.ts";
import type { ProgressiveContentStore } from "../../src/content/index.ts";
import { testLocks } from "../fixtures/application-locks.ts";

async function fixture() {
  const factory = new IDBFactory();
  const locks = testLocks();
  const saves = createStoryMigrationPort(factory);
  const release = {
    content: {
      receiptId: "a".repeat(64),
      manifestVersion: "b".repeat(64),
      releaseSequence: 1,
      chapterIds: ["chapter-01"],
    },
    story: storyReleaseFixture(),
    dispose: vi.fn(),
  } as unknown as PreparedRelease;
  const store = {
    readManifest: vi.fn(async () => ({
      releaseSequence: 1,
      coreRange: { min: 1, maxExclusive: 2 },
    })),
    verifyRequired: vi.fn(async () => undefined),
  } as unknown as ProgressiveContentStore;
  const selector = createApplicationSelector({
    factory,
    locks,
    store,
    coreContentApiVersion: 1,
  });
  await selector.activate(0, release, saves, new AbortController().signal);
  const prepare = vi.fn(async () => release);
  const readiness = createApplicationReadiness({
    selector,
    locks,
    store,
    saves,
    prepare,
    coreContentApiVersion: 1,
  });
  return {
    factory,
    locks,
    saves,
    release,
    store,
    selector,
    readiness,
    prepare,
  };
}
describe("Application readiness", () => {
  it("Offline bootstrap: latest URL down, cached required pair", async () => {
    const f = await fixture();
    const session = await f.readiness.acquire(new AbortController().signal);
    expect(session.prepared).toBe(f.release);
    expect(session.selection.storyGenerationId).not.toBeNull();
    await session.close();
    const next = await f.readiness.acquire(new AbortController().signal);
    expect(f.prepare).toHaveBeenCalledOnce();
    await next.close();
  });
  it("normal save and reload accepts active descriptor, never original seal", async () => {
    const f = await fixture();
    const verify = vi.spyOn(f.saves, "verifySeal");
    const session = await f.readiness.acquire(new AbortController().signal);
    await session.saves.write(
      "manual:1",
      createInitialStoryState(),
      null,
      storyBindingFixture(),
    );
    await session.saves.clear("autosave");
    await session.close();
    f.readiness.clear();
    const next = await f.readiness.acquire(new AbortController().signal);
    expect((await next.saves.read("manual:1")).kind).toBe("ready");
    expect(verify).not.toHaveBeenCalled();
    await next.close();
  });
  it("storage loss: missing selected generation refuses without fallback", async () => {
    const f = await fixture();
    vi.spyOn(f.saves, "verifyActiveGeneration").mockRejectedValueOnce(
      new Error("STORY_MIGRATION_FAILED"),
    );
    await expect(
      f.readiness.acquire(new AbortController().signal),
    ).rejects.toThrow("STORY_MIGRATION_FAILED");
    expect((await f.selector.read()).generation).toBe(1);
    expect(
      (
        await f.selector.activate(
          1,
          f.release,
          f.saves,
          new AbortController().signal,
        )
      ).kind,
    ).toBe("activated");
  });
  it("lease remains held through pending save; disposed repository refuses new writes", async () => {
    const f = await fixture();
    const pending = Promise.withResolvers<void>();
    const repository = f.saves.repository;
    vi.spyOn(f.saves, "repository").mockImplementation((id) => ({
      ...repository(id),
      clear: async () => pending.promise,
    }));
    const session = await f.readiness.acquire(new AbortController().signal);
    const saving = session.saves.clear("manual:1");
    const closing = session.close();
    expect(
      await f.selector.activate(
        1,
        f.release,
        f.saves,
        new AbortController().signal,
      ),
    ).toEqual({ kind: "blocked", code: "APP_SESSION_ACTIVE" });
    pending.resolve();
    await saving;
    await closing;
    await expect(session.saves.clear("manual:1")).rejects.toThrow(
      "APP_SESSION_CLOSED",
    );
  });
});

it("selected generation storage eviction is detected on next acquire without changing selector", async () => {
  const f = await fixture();
  const selection = await f.selector.read();
  const session = await f.readiness.acquire(new AbortController().signal);
  await session.close();
  const request = f.factory.open("ygo-story-saves");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("generations", "readwrite");
    tx.objectStore("generations").delete(selection.storyGenerationId!);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  await expect(
    f.readiness.acquire(new AbortController().signal),
  ).rejects.toThrow("STORY_MIGRATION_FAILED");
  expect(await f.selector.read()).toEqual(selection);
});

it("selected gameplay retains pinned optional image leases without gating on missing media", async () => {
  const { selectedGameplay } =
    await import("../../src/shell/application/selected-gameplay.ts");
  const { storyCardsFixture } = await import("../fixtures/story-release.ts");
  const cards = storyCardsFixture();
  const release = vi.fn();
  const acquire = vi.fn(async (code: number) =>
    code === cards.all()[0]!.code ? { url: "blob:fixture", release } : null,
  );
  const prepared = {
    story: storyReleaseFixture(),
    cards,
    images: { acquire },
    storyMedia: { acquireSetImage: async () => null },
    battle: { load: async () => ({ snapshotId: "fixture" }) },
  } as unknown as PreparedRelease;
  const gameplay = await selectedGameplay(
    prepared,
    new AbortController().signal,
  );
  const library = await gameplay.images();
  expect(library.cardUrls.get(cards.all()[0]!.code)).toBe("blob:fixture");
  expect(acquire).toHaveBeenCalledTimes(cards.all().length);
  library.dispose();
  library.dispose();
  expect(release).toHaveBeenCalledOnce();
});

it("menu shared-lease write snapshots state before waiting for acquisition", async () => {
  const { menuSaves } = await import("../../src/shell/core/menu-saves.ts");
  const pending = Promise.withResolvers<ShellDomainSession>();
  const write = vi.fn(async () => ({ kind: "written" as const, revision: 1 }));
  const repository = menuSaves({ acquire: () => pending.promise } as never);
  const state = { ...createInitialStoryState(), dp: 123 };
  const result = repository.write(
    "manual:1",
    state,
    null,
    storyBindingFixture(),
  );
  state.dp = 999;
  pending.resolve({ saves: { write }, close: async () => undefined } as never);
  await result;
  expect(write).toHaveBeenCalledWith(
    "manual:1",
    expect.objectContaining({ dp: 123 }),
    null,
    storyBindingFixture(),
  );
});
