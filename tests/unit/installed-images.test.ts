import { describe, expect, it, vi } from "vitest";
import type { InstalledAssetLease } from "../../src/content/index.ts";
import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";

const acquired = vi.hoisted(() => vi.fn());
vi.mock("../../src/content/acquire-installed-asset.ts", () => ({
  acquireInstalledAsset: acquired,
}));

import { loadInstalledImages } from "../../src/content/load-installed-images.ts";

describe("installed image library", () => {
  it("uses installed file refs then releases every object URL lease", async () => {
    const releases: ReturnType<typeof vi.fn>[] = [];
    acquired.mockImplementation(async (_reader, _content, file) => {
      const release = vi.fn();
      releases.push(release);
      return {
        kind: "ok",
        value: {
          url: `blob:${file.path}`,
          release,
        } satisfies InstalledAssetLease,
      };
    });
    const gameplay = installedGameplayFixture({
      sets: Object.freeze([
        {
          ...installedGameplayFixture().sets[0]!,
          image: {
            packId: "chapter-01",
            path: "chapters/chapter-01/sets/installed.jpg",
          },
        },
      ]),
    });

    const images = await loadInstalledImages({} as never, gameplay);

    expect(images.cardUrls.get(1)).toBe("blob:chapters/chapter-01/cards/1.jpg");
    expect(images.setUrls.get("installed-set")).toBe(
      "blob:chapters/chapter-01/sets/installed.jpg",
    );
    expect(acquired).toHaveBeenCalledTimes(gameplay.cards.length + 1);

    images.dispose();
    images.dispose();
    expect(releases.every((release) => release.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it("stops installed image reads after cancellation", async () => {
    acquired.mockClear();
    const release = vi.fn();
    let finish!: (result: { kind: "ok"; value: InstalledAssetLease }) => void;
    acquired.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const abort = new AbortController();
    const loading = loadInstalledImages(
      {} as never,
      installedGameplayFixture(),
      abort.signal,
    );

    abort.abort();
    finish({ kind: "ok", value: { url: "blob:first", release } });

    await expect(loading).rejects.toThrow("This operation was aborted");
    expect(acquired).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });
  it.each(["last card", "last set"])(
    "releases all leases when aborted acquiring %s",
    async (last) => {
      acquired.mockReset();
      const controller = new AbortController();
      const release = vi.fn();
      const fixture = installedGameplayFixture();
      const gameplay = installedGameplayFixture({
        cards: fixture.cards.slice(0, 1),
        sets:
          last === "last card"
            ? []
            : [{ ...fixture.sets[0]!, image: fixture.cards[0]!.fullImage }],
      });
      let calls = 0;
      const count = last === "last card" ? 1 : 2;
      acquired.mockImplementation(async () => {
        if (++calls === count) controller.abort();
        return { kind: "ok", value: { url: "blob:test", release } };
      });
      await expect(
        loadInstalledImages({} as never, gameplay, controller.signal),
      ).rejects.toThrow("This operation was aborted");
      expect(release).toHaveBeenCalledTimes(count);
    },
  );
});
