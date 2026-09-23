// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { cardCode } from "../../src/cards/index.ts";
import type {
  ContentReader,
  ProgressiveManifest,
  StagedContent,
} from "../../src/content/index.ts";
import { createProgressiveReleaseMedia } from "../../src/shell/adapters/progressive-release-media.ts";

const image = {
  packId: "chapter-01" as const,
  path: "chapters/chapter-01/card.png",
};
const staged: StagedContent = {
  receiptId: "a".repeat(64),
  manifestVersion: "b".repeat(64),
  releaseSequence: 1,
  chapterIds: ["chapter-01"],
};
const manifest: ProgressiveManifest = {
  schemaVersion: 3,
  releaseSequence: 1,
  coreRange: { min: 1, maxExclusive: 2 },
  runtimeSnapshotId: "c".repeat(64),
  chapters: [
    {
      id: "chapter-01",
      title: "Chapter One",
      description: "Prologue",
      depends: [],
      gameplayPath: "chapters/chapter-01/gameplay.json",
      storyPath: null,
    },
  ],
  files: [
    {
      path: image.path,
      version: "d".repeat(64),
      bytes: 4,
      mediaType: "image/png",
      role: "media",
      required: false,
      packIds: ["chapter-01"],
    },
  ],
};

describe("progressive release media", () => {
  it("cancels an in-flight cache read when the release is disposed", async () => {
    const started = Promise.withResolvers<void>();
    const finished = Promise.withResolvers<Uint8Array | null>();
    let readSignal: AbortSignal | undefined;
    const reader: ContentReader = {
      readManifest: vi.fn(async () => manifest),
      verifyRequired: vi.fn(async () => undefined),
      readFile: vi.fn(async (_version, _path, signal) => {
        readSignal = signal;
        signal.addEventListener("abort", () => finished.resolve(null), {
          once: true,
        });
        started.resolve();
        return finished.promise;
      }),
    };
    const media = createProgressiveReleaseMedia(
      reader,
      staged,
      manifest,
      new Map([[`${cardCode(1)}:full`, image]]),
      new Map(),
      new Map(),
    );

    const pending = media.images.acquire(
      cardCode(1),
      "full",
      new AbortController().signal,
    );
    await started.promise;
    media.dispose();
    const cancelled = readSignal?.aborted;
    finished.resolve(null);

    await expect(pending).resolves.toBeNull();
    expect(cancelled).toBe(true);
  });
});
