import { describe, expect, it } from "vitest";
import {
  parseProgressiveManifest,
  type ReleaseFile,
} from "../../src/content/index.ts";

const hash = "0".repeat(64);

function file(index: number): ReleaseFile {
  const path = `files/${String(index).padStart(5, "0")}.png`;
  if (index === 0)
    return {
      path,
      version: hash,
      bytes: 0,
      mediaType: "application/json",
      role: "runtime",
      required: true,
      packIds: ["runtime"],
    };
  if (index === 1)
    return {
      path,
      version: hash,
      bytes: 0,
      mediaType: "application/json",
      role: "gameplay",
      required: true,
      packIds: ["chapter-01"],
    };
  if (index === 2)
    return {
      path,
      version: hash,
      bytes: 0,
      mediaType: "application/json",
      role: "story",
      required: true,
      packIds: ["chapter-01"],
    };
  return {
    path,
    version: hash,
    bytes: 0,
    mediaType: "image/png",
    role: "media",
    required: false,
    packIds: ["chapter-01"],
  };
}

function manifest(count: number) {
  return {
    schemaVersion: 3,
    releaseSequence: 1,
    coreRange: { min: 1, maxExclusive: 2 },
    runtimeSnapshotId: hash,
    chapters: [
      {
        id: "chapter-01",
        title: "Chapter 1",
        description: "Fixture",
        depends: [],
        gameplayPath: "files/00001.png",
        storyPath: "files/00002.png",
      },
    ],
    files: Array.from({ length: count }, (_, index) => file(index)),
  } as const;
}

describe("progressive manifest producer bounds", () => {
  it("accepts exactly 50,000 file entries within 32 MiB", () => {
    expect(parseProgressiveManifest(manifest(50_000)).files).toHaveLength(
      50_000,
    );
  });

  it("rejects 50,001 file entries", () => {
    expect(() => parseProgressiveManifest(manifest(50_001))).toThrow(
      "CONTENT_INVALID_MANIFEST",
    );
  });

  it("rejects legacy ZIP manifest schema", () => {
    expect(() =>
      parseProgressiveManifest({ schemaVersion: 2, parts: [], files: [] }),
    ).toThrow("CONTENT_INVALID_MANIFEST");
  });
});
