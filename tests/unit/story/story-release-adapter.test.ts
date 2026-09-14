// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { readStagedStory } from "../../../src/shell/adapters/story-release.ts";
import type {
  ContentReader,
  ProgressiveManifest,
  StagedContent,
} from "../../../src/content/index.ts";
import { installedGameplayFixture } from "../../fixtures/installed-gameplay.ts";
import { storyReleaseFixture } from "../../fixtures/story-release.ts";
afterEach(() => vi.restoreAllMocks());
function fixture() {
  const gameplay = installedGameplayFixture();
  const semantic = storyReleaseFixture().chapters[0]!;
  const mapImage = {
    packId: "chapter-01" as const,
    path: "chapters/chapter-01/map.png",
  };
  const document = { ...semantic.document!, mapImage };
  const wire = {
    schemaVersion: 1,
    chapterId: "chapter-01",
    cards: gameplay.cards,
    sets: gameplay.sets,
    decks: gameplay.decks,
    opponents: gameplay.opponents,
    defaults: gameplay.defaults,
    story: {
      contentId: "prototype-prologue-v1",
      document: {
        packId: "chapter-01",
        path: "chapters/chapter-01/story.json",
      },
    },
  };
  const manifest: ProgressiveManifest = {
    schemaVersion: 3,
    releaseSequence: 7,
    coreRange: { min: 1, maxExclusive: 2 },
    runtimeSnapshotId: "a".repeat(64),
    chapters: [
      {
        id: "chapter-01",
        title: "Chapter One",
        description: "Prologue",
        depends: [],
        gameplayPath: "chapters/chapter-01/gameplay.json",
        storyPath: "chapters/chapter-01/story.json",
      },
    ],
    files: [
      {
        path: mapImage.path,
        version: "b".repeat(64),
        bytes: 3,
        role: "media",
        required: false,
        packIds: ["chapter-01"],
        mediaType: "image/png",
      },
    ],
  };
  const staged: StagedContent = {
    receiptId: "receipt",
    manifestVersion: "c".repeat(64),
    releaseSequence: 7,
    chapterIds: ["chapter-01"],
  };
  const json = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value));
  const readFile = vi.fn<ContentReader["readFile"]>(async (_version, path) =>
    path.endsWith("gameplay.json")
      ? json(wire)
      : path.endsWith("story.json")
        ? json(document)
        : null,
  );
  const reader: ContentReader = {
    verifyRequired: vi.fn(async () => undefined),
    readManifest: async () => manifest,
    readFile,
  };
  return { reader, readFile, staged, wire };
}
it("Shell maps producer fields/revision verbatim; missing map/set media never gates semantic Story", async () => {
  const f = fixture();
  const { release, media } = await readStagedStory(
    f.reader,
    f.staged,
    new AbortController().signal,
  );
  expect(release).toEqual({ ...storyReleaseFixture(), revision: 7 });
  expect(f.readFile).toHaveBeenCalledTimes(2);
  expect(
    await media.acquireMap("chapter-01", new AbortController().signal),
  ).toBeNull();
  expect(
    await media.acquireSetImage("installed-set", new AbortController().signal),
  ).toBeNull();
  expect(f.reader.verifyRequired).toHaveBeenCalledOnce();
});
it("Shell media uses cache reader, idempotent URL leases, corruption placeholder, canonical abort", async () => {
  const f = fixture();
  const { media } = await readStagedStory(
    f.reader,
    f.staged,
    new AbortController().signal,
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:map");
  const revoke = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);
  f.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  const lease = await media.acquireMap(
    "chapter-01",
    new AbortController().signal,
  );
  expect(lease?.url).toBe("blob:map");
  lease!.release();
  lease!.release();
  expect(revoke).toHaveBeenCalledTimes(1);
  f.readFile.mockRejectedValue(new Error("CONTENT_INTEGRITY_FAILED"));
  expect(
    await media.acquireMap("chapter-01", new AbortController().signal),
  ).toBeNull();
  const controller = new AbortController();
  controller.abort("caller reason");
  await expect(
    media.acquireMap("chapter-01", controller.signal),
  ).rejects.toMatchObject({
    name: "AbortError",
    message: "The operation was aborted.",
  });
});
it("required invalid document fails before any optional media read", async () => {
  const f = fixture();
  const original = f.readFile.getMockImplementation()!;
  f.readFile.mockImplementation(async (version, path, signal) =>
    path.endsWith("story.json")
      ? new TextEncoder().encode('{"schemaVersion":9}')
      : original(version, path, signal),
  );
  await expect(
    readStagedStory(f.reader, f.staged, new AbortController().signal),
  ).rejects.toThrow("STORY_RELEASE_INVALID");
  expect(
    f.readFile.mock.calls.every(([, path]) => path.endsWith(".json")),
  ).toBe(true);
});
