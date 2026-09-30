// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import * as shellCachePolicy from "../../src/shell/pwa/shell-cache-policy.ts";
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
    await assertApprovalBeforePrecache(source);
    expect(source).not.toContain("precache.precache(");
    expect(source).not.toContain("skipWaiting");
    expect(source).not.toContain("clients.claim");
  });

  it("rejects a source-copy mutation that installs before approval", async () => {
    const source = await readFile(
      new URL("../../src/service-worker.ts", import.meta.url),
      "utf8",
    );
    const mutated = source
      .replace("      await precache.install(event);", "")
      .replace(
        "      if (!firstInstall) {",
        "      await precache.install(event);\n      if (!firstInstall) {",
      );
    expect(mutated).not.toBe(source);
    await expect(assertApprovalBeforePrecache(mutated)).rejects.toThrow(
      "precache must wait for approval",
    );
    await assertApprovalBeforePrecache(source);
  });
});

/** Execute the real install handler; imports and browser services are sandbox ports. */
async function assertApprovalBeforePrecache(source: string): Promise<void> {
  const code = transpileModule(source, {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  for (const approval of [
    null,
    candidate("other-build"),
    candidate("build-b", 1),
    candidate("build-b"),
  ]) {
    const install = vi.fn(async () => undefined);
    let approve!: (value: typeof approval) => void;
    const pending = new Promise<typeof approval>((resolve) => {
      approve = resolve;
    });
    const readApproval = vi.fn(() => pending);
    let handler!: (event: { waitUntil(value: Promise<void>): void }) => void;
    runInNewContext(code, {
      exports: {},
      URL,
      __APP_BUILD_ID__: "build-b",
      __CORE_CONTENT_API_VERSION__: 2,
      self: {
        __WB_MANIFEST: ["index.html"],
        registration: { active: {}, scope: "https://core.invalid/" },
        indexedDB: {},
        caches: { open: async () => ({ match: async () => undefined }) },
        addEventListener: (type: string, callback: typeof handler) => {
          if (type === "install") handler = callback;
        },
      },
      require: (id: string) => {
        if (id === "workbox-precaching")
          return {
            PrecacheController: class {
              addToCacheList() {}
              install = install;
            },
          };
        if (id.endsWith("/core-update-approval.ts"))
          return { readCoreApproval: readApproval };
        if (id.endsWith("/shell-cache-policy.ts")) return shellCachePolicy;
        throw new Error(`Unexpected SW import: ${id}`);
      },
    });
    let completion!: Promise<void>;
    handler({ waitUntil: (value) => (completion = value) });
    await vi.waitFor(() => expect(readApproval).toHaveBeenCalledOnce());
    // Pending approval must block all executable precache work, not just imports.
    expect(install, "precache must wait for approval").not.toHaveBeenCalled();
    approve(approval);
    if (
      approval?.buildId === "build-b" &&
      approval.coreContentApiVersion === 2
    ) {
      await completion;
      expect(install).toHaveBeenCalledOnce();
    } else {
      await expect(completion).rejects.toThrow("CORE_UPDATE_NOT_APPROVED");
      expect(install).not.toHaveBeenCalled();
    }
  }
}
