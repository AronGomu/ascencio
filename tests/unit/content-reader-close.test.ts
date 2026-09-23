import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentSetRef } from "../../src/content/contracts/content-set-ref.ts";
import { ContentReader } from "../../src/content/storage/content-reader.ts";
import { TestLockManager } from "../fixtures/progressive-storage.ts";

const content: ContentSetRef = {
  catalogSha256: "a".repeat(64),
  snapshot: {
    activationId: "b".repeat(64),
    runtimeSnapshotId: "c".repeat(64),
    runtimeManifestSha256: "d".repeat(64),
    releaseCatalogSha256: "e".repeat(64),
  },
  runtime: { packId: "runtime", sha256: "f".repeat(64), bytes: 1 },
  chapters: [{ packId: "chapter-01", sha256: "1".repeat(64), bytes: 1 }],
};

afterEach(() => vi.unstubAllGlobals());

describe("ContentReader close", () => {
  it("releases a session lease acquired while the reader closes", async () => {
    const locks = new TestLockManager();
    vi.stubGlobal("navigator", { locks });
    vi.stubGlobal("BroadcastChannel", undefined);
    const db = {
      close: vi.fn(),
    } as unknown as ConstructorParameters<typeof ContentReader>[0];
    const reader = new ContentReader(
      db,
      {} as ConstructorParameters<typeof ContentReader>[1],
    );
    const verification = Promise.withResolvers<{
      readonly kind: "ok";
      readonly value: ContentSetRef;
    }>();
    const reachedVerification = Promise.withResolvers<void>();
    let inspections = 0;
    vi.spyOn(reader, "inspectContent").mockImplementation(async () => {
      inspections++;
      if (inspections === 1) return { kind: "ok", value: content };
      reachedVerification.resolve();
      return verification.promise;
    });

    const acquiring = reader.acquireSession(content);
    await reachedVerification.promise;
    expect(locks.held.size).toBe(2);
    reader.close();
    verification.resolve({ kind: "ok", value: content });
    const result = await acquiring;
    const heldAfterClose = locks.held.size;
    if (result.kind === "ok") result.value.release();

    expect(result).toMatchObject({
      kind: "failed",
      code: "CONTENT_STORAGE_UNAVAILABLE",
    });
    expect(heldAfterClose).toBe(0);
  });
});
