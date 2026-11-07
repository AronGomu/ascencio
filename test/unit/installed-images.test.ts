import { expect, it, vi } from "vitest";
import { loadSqliteStoryImageLibrary } from "../../src/shell/adapters/sqlite-story-media.ts";
import { storyReleaseFixture } from "../fixtures/story-release.ts";

it("loads only selected set art; card library remains lazy; dispose releases every set lease once", async () => {
  const release = vi.fn();
  const media = {
    acquireMap: vi.fn(async () => null),
    acquireSetImage: vi.fn(async () => ({ url: "blob:set", release })),
  };
  const library = await loadSqliteStoryImageLibrary(
    storyReleaseFixture().chapters[0]!.sets,
    media,
    new AbortController().signal,
  );
  expect(library.cardUrls.size).toBe(0);
  expect(library.setUrls.get("installed-set")).toBe("blob:set");
  expect(media.acquireMap).not.toHaveBeenCalled();
  library.dispose();
  library.dispose();
  expect(release).toHaveBeenCalledOnce();
});
it("failed or cancelled set read releases prior leases", async () => {
  const release = vi.fn();
  const signal = new AbortController().signal;
  const acquireSetImage = vi
    .fn()
    .mockResolvedValueOnce({ url: "blob:set", release })
    .mockRejectedValueOnce(
      new DOMException("The operation was aborted.", "AbortError"),
    );
  const sets = storyReleaseFixture().chapters[0]!.sets;
  await expect(
    loadSqliteStoryImageLibrary(
      [...sets, { ...sets[0]!, id: "second" }],
      { acquireMap: async () => null, acquireSetImage },
      signal,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(release).toHaveBeenCalledOnce();
});
