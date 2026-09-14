import { beforeEach, describe, expect, it, vi } from "vitest";
import { cardCode } from "../../src/cards/index.ts";
import type { InstalledAssetLease } from "../../src/content/index.ts";
import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";

const acquireInstalledAsset = vi.hoisted(() => vi.fn());
vi.mock("../../src/content/index.ts", () => ({ acquireInstalledAsset }));

import { createInstalledCardImageSource } from "../../src/shell/cards/installed-card-image-source.ts";

const failed = { kind: "failed", code: "CONTENT_MISSING" } as const;

beforeEach(() => {
  acquireInstalledAsset.mockReset();
});

describe("installed CardImageSource", () => {
  it.each(["failed", "rejected"] as const)(
    "rejects exact abort after a late %s read without reporting missing media",
    async (outcome) => {
      const deferred = Promise.withResolvers<unknown>();
      acquireInstalledAsset.mockReturnValueOnce(deferred.promise);
      const gameplay = installedGameplayFixture();
      const report = vi.fn();
      const source = createInstalledCardImageSource(
        {} as never,
        gameplay,
        report,
      );
      const controller = new AbortController();
      const pending = source.acquire(
        cardCode(gameplay.cards[0]!.code),
        "full",
        controller.signal,
      );
      const rejected = expect(pending).rejects.toMatchObject({
        name: "AbortError",
        message: "The operation was aborted.",
      });
      await vi.waitFor(() =>
        expect(acquireInstalledAsset).toHaveBeenCalledOnce(),
      );
      controller.abort();
      if (outcome === "failed") deferred.resolve(failed);
      else deferred.reject(new Error("private read details"));
      await rejected;
      await expect(pending).rejects.toBeInstanceOf(DOMException);
      expect(report).not.toHaveBeenCalled();
    },
  );

  it("removes queued aborts without reading or consuming the next read slot", async () => {
    const deferred = Promise.withResolvers<typeof failed>();
    acquireInstalledAsset.mockReturnValue(deferred.promise);
    const gameplay = installedGameplayFixture();
    const report = vi.fn();
    const source = createInstalledCardImageSource(
      {} as never,
      gameplay,
      report,
    );
    const code = cardCode(gameplay.cards[0]!.code);
    const active = Array.from({ length: 4 }, () =>
      source.acquire(code, "full", new AbortController().signal),
    );
    const controller = new AbortController();
    const queued = source.acquire(code, "full", controller.signal);
    const rejected = expect(queued).rejects.toMatchObject({
      name: "AbortError",
      message: "The operation was aborted.",
    });
    const next = source.acquire(code, "full", new AbortController().signal);
    await vi.waitFor(() =>
      expect(acquireInstalledAsset).toHaveBeenCalledTimes(4),
    );
    controller.abort();
    await rejected;
    await expect(queued).rejects.toBeInstanceOf(DOMException);
    expect(report).not.toHaveBeenCalled();
    expect(acquireInstalledAsset).toHaveBeenCalledTimes(4);
    deferred.resolve(failed);
    await expect(Promise.all([...active, next])).resolves.toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(acquireInstalledAsset).toHaveBeenCalledTimes(5);
  });

  it.each([
    ["CONTENT_MISSING", "missing"],
    ["CONTENT_INTEGRITY_FAILED", "corrupt"],
    ["CONTENT_STORAGE_UNAVAILABLE", "unreadable"],
  ])("reports sanitized missing-media status for %s", async (code, reason) => {
    acquireInstalledAsset.mockResolvedValue({
      kind: "failed",
      code,
      path: "private/path",
      packId: "private-pack",
      payload: "private payload",
    });
    const gameplay = installedGameplayFixture();
    const report = vi.fn();
    const source = createInstalledCardImageSource(
      {} as never,
      gameplay,
      report,
    );
    await expect(
      source.acquire(
        cardCode(gameplay.cards[0]!.code),
        "full",
        new AbortController().signal,
      ),
    ).resolves.toBeNull();
    expect(report).toHaveBeenCalledExactlyOnceWith({
      kind: "missing-media",
      reason,
    });
  });

  it("reports thrown reads and unknown cards without raw error details or fallback reads", async () => {
    acquireInstalledAsset.mockRejectedValue(new Error("private read details"));
    const gameplay = installedGameplayFixture();
    const report = vi.fn();
    const source = createInstalledCardImageSource(
      {} as never,
      gameplay,
      report,
    );
    await expect(
      source.acquire(
        cardCode(gameplay.cards[0]!.code),
        "full",
        new AbortController().signal,
      ),
    ).resolves.toBeNull();
    await expect(
      source.acquire(cardCode(99999999), "full", new AbortController().signal),
    ).resolves.toBeNull();
    expect(report.mock.calls).toEqual([
      [{ kind: "missing-media", reason: "unreadable" }],
      [{ kind: "missing-media", reason: "missing" }],
    ]);
    expect(acquireInstalledAsset).toHaveBeenCalledOnce();
  });

  it("reads only exact installed refs and degrades unknown cards to null", async () => {
    acquireInstalledAsset.mockResolvedValue(failed);
    const gameplay = installedGameplayFixture();
    const source = createInstalledCardImageSource(
      {} as never,
      gameplay,
      vi.fn(),
    );
    const first = gameplay.cards[0]!;

    await expect(
      source.acquire(
        cardCode(first.code),
        "cropped",
        new AbortController().signal,
      ),
    ).resolves.toBeNull();
    await expect(
      source.acquire(cardCode(99999999), "full", new AbortController().signal),
    ).resolves.toBeNull();

    expect(acquireInstalledAsset).toHaveBeenCalledOnce();
    expect(acquireInstalledAsset).toHaveBeenCalledWith(
      expect.anything(),
      gameplay.content,
      first.croppedImage,
    );
  });

  it("returns available media without reporting missing-media status", async () => {
    const lease = { url: "blob:installed", release: vi.fn() };
    acquireInstalledAsset.mockResolvedValueOnce({ kind: "ok", value: lease });
    const gameplay = installedGameplayFixture();
    const report = vi.fn();
    const source = createInstalledCardImageSource(
      {} as never,
      gameplay,
      report,
    );
    await expect(
      source.acquire(
        cardCode(gameplay.cards[0]!.code),
        "full",
        new AbortController().signal,
      ),
    ).resolves.toBe(lease);
    expect(report).not.toHaveBeenCalled();
    expect(lease.release).not.toHaveBeenCalled();
  });

  it("caps concurrent installed reads at four", async () => {
    const continuations: Array<(result: typeof failed) => void> = [];
    acquireInstalledAsset.mockImplementation(
      () =>
        new Promise((resolve) => {
          continuations.push(resolve);
        }),
    );
    const gameplay = installedGameplayFixture();
    const source = createInstalledCardImageSource(
      {} as never,
      gameplay,
      vi.fn(),
    );
    const requests = gameplay.cards
      .slice(0, 5)
      .map((card) =>
        source.acquire(
          cardCode(card.code),
          "full",
          new AbortController().signal,
        ),
      );

    await vi.waitFor(() =>
      expect(acquireInstalledAsset).toHaveBeenCalledTimes(4),
    );
    continuations[0]!(failed);
    await vi.waitFor(() =>
      expect(acquireInstalledAsset).toHaveBeenCalledTimes(5),
    );
    for (const resume of continuations.slice(1)) resume(failed);

    await expect(Promise.all(requests)).resolves.toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("releases a lease completed after abort and reports exact abort error", async () => {
    let finish!: (result: { kind: "ok"; value: InstalledAssetLease }) => void;
    acquireInstalledAsset.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const gameplay = installedGameplayFixture();
    const report = vi.fn();
    const source = createInstalledCardImageSource(
      {} as never,
      gameplay,
      report,
    );
    const controller = new AbortController();
    const release = vi.fn();
    const pending = source.acquire(
      cardCode(gameplay.cards[0]!.code),
      "full",
      controller.signal,
    );

    await vi.waitFor(() =>
      expect(acquireInstalledAsset).toHaveBeenCalledOnce(),
    );
    controller.abort();
    finish({ kind: "ok", value: { url: "blob:late", release } });

    await expect(pending).rejects.toMatchObject({
      name: "AbortError",
      message: "The operation was aborted.",
    });
    await expect(pending).rejects.toBeInstanceOf(DOMException);
    expect(release).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });
});
