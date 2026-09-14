// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { ProgressiveContentStore } from "../../src/content/index.ts";
import { createApplicationSelector } from "../../src/shell/application/application-selector.ts";
import { selectionTransaction } from "../../src/shell/application/application-state.ts";
import {
  readCoreApproval,
  writeCoreApproval,
} from "../../src/shell/application/core-update-approval.ts";
import { createStoryMigrationPort } from "../../src/story/saves/index.ts";
import type { PreparedRelease } from "../../src/shell/application/prepared-release.ts";
import { storyReleaseFixture } from "../fixtures/story-release.ts";
import { testLocks } from "../fixtures/application-locks.ts";

const candidate = (buildId: string, coreContentApiVersion = 2) => ({
  schemaVersion: 1 as const,
  buildId,
  coreContentApiVersion,
});

describe("CORE update approval", () => {
  it("is durable for exact build and blocks a third build while waiting", async () => {
    const factory = new IDBFactory();
    await selectionTransaction(factory);
    const b = await writeCoreApproval(
      factory,
      candidate("build-b"),
      0,
      "build-a",
      10,
    );
    expect(await readCoreApproval(factory)).toEqual(b);
    await expect(
      writeCoreApproval(factory, candidate("build-c"), 0, "build-a", 11),
    ).rejects.toThrow("CORE_UPDATE_PENDING");
    await expect(
      writeCoreApproval(factory, candidate("build-b"), 0, "build-a", 12),
    ).resolves.toMatchObject({ buildId: "build-b", approvedAt: 12 });
    await expect(
      writeCoreApproval(factory, candidate("build-c"), 0, "build-b", 13),
    ).resolves.toMatchObject({ buildId: "build-c" });
  });

  it("Pending approval race: incompatible activation remains blocked", async () => {
    const factory = new IDBFactory();
    await selectionTransaction(factory);
    await writeCoreApproval(factory, candidate("build-b", 2), 0, "build-a", 10);
    const store = {
      readManifest: vi.fn(async () => ({
        releaseSequence: 1,
        coreRange: { min: 1, maxExclusive: 2 },
      })),
      verifyRequired: vi.fn(async () => undefined),
    } as unknown as ProgressiveContentStore;
    const selector = createApplicationSelector({
      factory,
      locks: testLocks(),
      store,
      coreContentApiVersion: 1,
      currentBuildId: "build-a",
    });
    const prepared = {
      content: {
        receiptId: "a".repeat(64),
        manifestVersion: "b".repeat(64),
        releaseSequence: 1,
        chapterIds: ["chapter-01"],
      },
      story: storyReleaseFixture(),
    } as unknown as PreparedRelease;
    const saves = createStoryMigrationPort(factory);
    await expect(
      selector.activate(0, prepared, saves, new AbortController().signal),
    ).resolves.toEqual({ kind: "blocked", code: "APP_CORE_INCOMPATIBLE" });
    expect(store.verifyRequired).not.toHaveBeenCalled();
  });

  it("SW manually gates precache before install and never forces activation", async () => {
    const source = await readFile(
      new URL("../../src/service-worker.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("precache.addToCacheList");
    expect(source).toContain("readCoreApproval");
    expect(source).toContain('throw new Error("CORE_UPDATE_NOT_APPROVED")');
    expect(source.indexOf("readCoreApproval")).toBeLessThan(
      source.indexOf("await precache.install(event)"),
    );
    expect(source).not.toContain("precache.precache(");
    expect(source).not.toContain("skipWaiting");
    expect(source).not.toContain("clients.claim");
  });
});
