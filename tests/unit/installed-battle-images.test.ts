import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstalledAssetLease } from "../../src/content/index.ts";
import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";

const acquire = vi.hoisted(() => vi.fn());
vi.mock("../../src/content/acquire-installed-asset.ts", () => ({
  acquireInstalledAsset: acquire,
}));

import { createInstalledCardImageLibrary } from "../../src/battle/app/images/card-image-cache.ts";

function deferred<T>() {
  return Promise.withResolvers<T>();
}

function lease() {
  return { url: "blob:installed", release: vi.fn() };
}

beforeEach(() => acquire.mockReset());

describe("installed battle image teardown", () => {
  it("registers a deferred acquired lease before checking abort", async () => {
    const pending = deferred<{ kind: "ok"; value: InstalledAssetLease }>();
    acquire.mockReturnValueOnce(pending.promise);
    const controller = new AbortController();
    const gameplay = installedGameplayFixture();
    const loading = createInstalledCardImageLibrary(
      {} as never,
      { ...gameplay, cards: gameplay.cards.slice(0, 1) },
      undefined,
      controller.signal,
    );
    const rejected = expect(loading).rejects.toThrow(
      "This operation was aborted",
    );
    controller.abort();
    const acquired = lease();
    pending.resolve({ kind: "ok", value: acquired });
    await rejected;
    expect(acquired.release).toHaveBeenCalledOnce();
    expect(acquire).toHaveBeenCalledOnce();
  });

  it.each(["rejected promise", "failed result"])(
    "drains late sibling successes after %s without scheduling more work",
    async (failure) => {
      const gameplay = installedGameplayFixture();
      const cards = Array.from({ length: 12 }, (_, index) => ({
        ...gameplay.cards[0]!,
        code: index + 1,
      }));
      const pending = Array.from({ length: 6 }, () =>
        deferred<
          | { kind: "ok"; value: InstalledAssetLease }
          | { kind: "failed"; code: string }
        >(),
      );
      for (const entry of pending) acquire.mockReturnValueOnce(entry.promise);
      const loading = createInstalledCardImageLibrary({} as never, {
        ...gameplay,
        cards,
      });
      let settled = false;
      const result = loading.catch((error: unknown) => {
        settled = true;
        return error;
      });
      expect(acquire).toHaveBeenCalledTimes(6);
      if (failure === "rejected promise")
        pending[0]!.reject(new Error("acquire failed"));
      else pending[0]!.resolve({ kind: "failed", code: "acquire failed" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const settledBeforeDrain = settled;
      const leases = pending.slice(1).map(() => lease());
      for (const [index, entry] of pending.slice(1).entries())
        entry.resolve({ kind: "ok", value: leases[index]! });
      expect(await result).toEqual(new Error("acquire failed"));
      expect(settledBeforeDrain).toBe(false);
      expect(acquire).toHaveBeenCalledTimes(6);
      for (const acquired of leases)
        expect(acquired.release).toHaveBeenCalledOnce();
    },
  );

  it("releases every successful acquisition exactly once on repeated disposal", async () => {
    const leases: ReturnType<typeof lease>[] = [];
    acquire.mockImplementation(async () => {
      const acquired = lease();
      leases.push(acquired);
      return { kind: "ok", value: acquired };
    });
    const library = await createInstalledCardImageLibrary(
      {} as never,
      installedGameplayFixture(),
    );
    expect(leases.length).toBeGreaterThan(0);
    library.dispose();
    library.dispose();
    for (const acquired of leases)
      expect(acquired.release).toHaveBeenCalledOnce();
  });
});
