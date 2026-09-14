// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseStoryRelease,
  validateStoryContinuity,
} from "../../../src/story/ports/index.ts";
import {
  storyReleaseFixture,
  mutableStoryRelease,
} from "../../fixtures/story-release.ts";

describe("Story semantic release", () => {
  it("preserves metadata/defaults, snapshots inputs, normalizes chapter order", () => {
    const input = storyReleaseFixture();
    const parsed = parseStoryRelease(input);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(Object.isFrozen(parsed.chapters[0]!.sets[0]!.cards)).toBe(true);
  });
  it.each([
    "default",
    "duplicate-beat",
    "rarity",
    "future",
    "unknown-card",
    "raw-media",
  ])("rejects invalid %s", (defect) => {
    const input = mutableStoryRelease();
    const chapter = input.chapters[0]!;
    if (defect === "default") chapter.defaults.starterDeckId = "missing";
    if (defect === "duplicate-beat")
      chapter.document!.beats.push(chapter.document!.beats[0]!);
    if (defect === "rarity")
      Reflect.set(chapter.sets[0]!.cards[0]!, "rarity", "mythic");
    if (defect === "future") Reflect.set(chapter.document!, "schemaVersion", 2);
    if (defect === "unknown-card") chapter.decks[0]!.main.push(999999999);
    if (defect === "raw-media")
      Reflect.set(chapter.document!, "mapImage", { path: "raw" });
    expect(() => parseStoryRelease(input)).toThrow("STORY_RELEASE_INVALID");
  });
  it("allows inserted beat; refuses removed references or backwards revision", () => {
    const source = storyReleaseFixture();
    const next = mutableStoryRelease(2);
    next.chapters[0]!.document!.beats.unshift({
      ...next.chapters[0]!.document!.beats[0]!,
      id: "inserted",
    });
    expect(() => validateStoryContinuity(source, next)).not.toThrow();
    next.chapters[0]!.document!.beats.splice(1, 1);
    expect(() => validateStoryContinuity(source, next)).toThrow(
      "STORY_CONTINUITY_FAILED",
    );
    expect(() =>
      validateStoryContinuity(storyReleaseFixture(2), source),
    ).toThrow("STORY_CONTINUITY_FAILED");
  });
});

it("preserves producer printing bounds including empty source rarity code", () => {
  const input = mutableStoryRelease();
  input.chapters[0]!.sets[0]!.releaseYear = 1;
  input.chapters[0]!.sets[0]!.cards[0]!.sourceRarityCode = "";
  input.chapters[0]!.sets[0]!.cards[0]!.printingCode = "x".repeat(512);
  expect(parseStoryRelease(input)).toEqual(input);
});
it("rejects undersized published decks and empty sets", () => {
  const input = mutableStoryRelease();
  input.chapters[0]!.decks[0]!.main = [];
  expect(() => parseStoryRelease(input)).toThrow("STORY_RELEASE_INVALID");
  const empty = mutableStoryRelease();
  empty.chapters[0]!.sets[0]!.cards = [];
  expect(() => parseStoryRelease(empty)).toThrow("STORY_RELEASE_INVALID");
});
it("canonicalizes chapter order; accepts only identical duplicate definitions", () => {
  const first = storyReleaseFixture().chapters[0]!;
  const reversed = {
    revision: 1,
    chapters: [{ ...first, id: "chapter-02" }, first],
  };
  expect(parseStoryRelease(reversed).chapters.map((c) => c.id)).toEqual([
    "chapter-01",
    "chapter-02",
  ]);
  const bad = mutableStoryRelease();
  bad.chapters.unshift({
    ...mutableStoryRelease().chapters[0]!,
    id: "chapter-02",
  });
  bad.chapters[0] = structuredClone(bad.chapters[0]!);
  bad.chapters[0]!.sets[0]!.name = "conflict";
  expect(() => parseStoryRelease(bad)).toThrow("STORY_RELEASE_INVALID");
});
it("rejects accessor-backed records and sparse arrays", () => {
  const input = mutableStoryRelease();
  Object.defineProperty(input, "revision", { get: () => 1, enumerable: true });
  expect(() => parseStoryRelease(input)).toThrow("STORY_RELEASE_INVALID");
  const sparse = mutableStoryRelease();
  delete sparse.chapters[0]!.document!.beats[0];
  expect(() => parseStoryRelease(sparse)).toThrow("STORY_RELEASE_INVALID");
});
