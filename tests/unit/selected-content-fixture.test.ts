import { describe, it, expect } from "vitest";
import { selectedContentRelease } from "../fixtures/selected-content-release.ts";
import { readProgressiveReleaseData } from "../../src/shell/adapters/progressive-release-data.ts";
import type { ContentReader, StagedContent } from "../../src/content/index.ts";

describe("selected Content regression fixture", () => {
  it("consolidated delivery preserves complete canonical runtime and selected semantic data", async () => {
    const release = await selectedContentRelease();
    const load = async (input: typeof release.canonical) => {
      const staged: StagedContent = {
        receiptId: "a".repeat(64),
        manifestVersion: "b".repeat(64),
        releaseSequence: 1,
        chapterIds: ["chapter-01"],
      };
      const reader: ContentReader = {
        readManifest: async () => input.manifest,
        readFile: async (_version, path) =>
          input.bytes.get(path)?.slice() ?? null,
        verifyRequired: async () => {
          for (const file of input.manifest.files.filter(
            ({ required }) => required,
          )) {
            const bytes = input.bytes.get(file.path)!;
            expect(bytes.byteLength, file.path).toBe(file.bytes);
            const hash = Buffer.from(
              await crypto.subtle.digest("SHA-256", bytes.slice()),
            ).toString("hex");
            expect(hash, file.path).toBe(file.version);
          }
        },
      };
      return readProgressiveReleaseData(
        reader,
        staged,
        new AbortController().signal,
      );
    };
    const canonical = await load(release.canonical);
    const consolidated = await load(release.consolidated);
    expect(
      await consolidated.battle.load(new AbortController().signal),
    ).toEqual(await canonical.battle.load(new AbortController().signal));
    expect(consolidated.chapterCards).toEqual(canonical.chapterCards);
    expect(consolidated.runtimeCards).toEqual(canonical.runtimeCards);
    expect(consolidated.story).toEqual(canonical.story);
    expect(consolidated.imageRefs).toEqual(canonical.imageRefs);
    expect(consolidated.mapRefs).toEqual(canonical.mapRefs);
    expect(consolidated.setImageRefs).toEqual(canonical.setImageRefs);
    expect(
      release.consolidated.manifest.files.filter(({ required }) => required)
        .length,
    ).toBeLessThan(20);
  }, 180_000);
});
