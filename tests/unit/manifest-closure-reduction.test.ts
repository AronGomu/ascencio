import { describe, expect, it } from "vitest";
import type { ContentManifest, ManifestRef } from "../../src/content/index.ts";
import {
  manifestClosure,
  reduceManifestClosure,
  type ManifestEntry,
} from "../../src/content/install/manifest-closure.ts";

const hash = (character: string) => character.repeat(64);
const runtime: ManifestRef = { packId: "runtime", sha256: hash("a"), bytes: 1 };
const chapterOne: ManifestRef = {
  packId: "chapter-01",
  sha256: hash("b"),
  bytes: 1,
};
const chapterTwo: ManifestRef = {
  packId: "chapter-02",
  sha256: hash("c"),
  bytes: 1,
};
const chapterThree: ManifestRef = {
  packId: "chapter-03",
  sha256: hash("d"),
  bytes: 1,
};

function entry(
  ref: ManifestRef,
  dependencies: readonly ManifestRef[],
): ManifestEntry {
  const manifest: ContentManifest = {
    schemaVersion: 2,
    packId: ref.packId,
    runtimeSnapshotId: hash("e"),
    storyContentId: null,
    gameplayPath:
      ref.packId === "runtime" ? null : `chapters/${ref.packId}/gameplay.json`,
    dependencies,
    cardCodes: ref.packId === "runtime" ? [1] : [],
    opponentIds: [],
    parts: [],
    files: [],
  };
  return { ref, manifest };
}

describe("manifest closure reduction", () => {
  it("removes invalid manifest and transitive dependants only", () => {
    const reduced = reduceManifestClosure(
      [
        entry(runtime, []),
        entry(chapterOne, [runtime]),
        entry(chapterTwo, [runtime, chapterOne]),
        entry(chapterThree, [runtime]),
      ],
      chapterOne,
    );
    expect(reduced.invalidated).toEqual([chapterOne, chapterTwo]);
    expect(reduced.retainedChapters).toEqual([chapterThree]);
    expect(reduced.runtimeInvalid).toBe(false);
  });

  it("rejects mixed runtime snapshots", async () => {
    const chapter = entry(chapterOne, [runtime]);
    const entries = new Map([
      [runtime.sha256, entry(runtime, []).manifest],
      [
        chapterOne.sha256,
        { ...chapter.manifest, runtimeSnapshotId: hash("f") },
      ],
    ]);
    await expect(
      manifestClosure([runtime, chapterOne], async (ref) =>
        entries.get(ref.sha256)!,
      ),
    ).rejects.toMatchObject({ code: "CONTENT_INCOMPATIBLE" });
  });

  it("rejects chapter graphs detached from runtime", async () => {
    const entries = new Map([
      [runtime.sha256, entry(runtime, []).manifest],
      [chapterOne.sha256, entry(chapterOne, []).manifest],
    ]);
    await expect(
      manifestClosure([runtime, chapterOne], async (ref) =>
        entries.get(ref.sha256)!,
      ),
    ).rejects.toMatchObject({ code: "CONTENT_INCOMPATIBLE" });
  });
});
