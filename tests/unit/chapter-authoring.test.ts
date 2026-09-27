import { describe, expect, it } from "vitest";
import { parseChapterSelections } from "../../scripts/lib/chapter-authoring/chapter-selections.ts";
import { parseChapterStoryDocument } from "../../scripts/lib/chapter-authoring/chapter-story-document.ts";

const selections = {
  schemaVersion: 1,
  sourceSha256: "a".repeat(64),
  chapters: [
    {
      id: "chapter-01",
      title: "Chapter One",
      published: true,
      setNames: ["Set One"],
      additionalCardCodes: [1],
      opponentIds: ["opponent"],
      storyContentId: "prototype-prologue-v1",
    },
  ],
};
const choices = ["trust-rin", "challenge-rin", "observe-first"];
const story = {
  schemaVersion: 1,
  contentId: "prototype-prologue-v1",
  title: "Prototype",
  beats: [
    {
      id: "arrival",
      speaker: null,
      kind: "narration",
      text: "Arrival.",
      background: "station",
      characters: [],
    },
  ],
  choices: choices.map((id) => ({ id, label: id })),
  choiceResponses: Object.fromEntries(choices.map((id) => [id, "Response."])),
  laterAcknowledgments: Object.fromEntries(
    choices.map((id) => [id, "Remembered."]),
  ),
  mapImage: { packId: "chapter-01", path: "story/media/map.svg" },
};
const invalid = {
  kind: "failed",
  code: "CONTENT_INVALID_MANIFEST",
  packId: null,
  path: null,
};

describe("pure chapter authoring parsers", () => {
  it("preserves complete selection and story values", () => {
    expect(parseChapterSelections(selections)).toEqual({
      kind: "ok",
      value: selections,
    });
    expect(parseChapterStoryDocument(story)).toEqual({
      kind: "ok",
      value: story,
    });
  });

  it.each(["setNames", "additionalCardCodes", "opponentIds"] as const)(
    "rejects duplicate selection %s",
    (key) => {
      const chapter = selections.chapters[0]!;
      expect(
        parseChapterSelections({
          ...selections,
          chapters: [{ ...chapter, [key]: [...chapter[key], ...chapter[key]] }],
        }),
      ).toEqual(invalid);
    },
  );

  it("retains the authored chapter-one and source-digest constraints", () => {
    expect(parseChapterSelections({ ...selections, chapters: [] })).toEqual(
      invalid,
    );
    expect(
      parseChapterSelections({
        ...selections,
        chapters: [{ ...selections.chapters[0], id: "chapter-02" }],
      }),
    ).toEqual(invalid);
    expect(
      parseChapterSelections({ ...selections, sourceSha256: "A".repeat(64) }),
    ).toEqual(invalid);
  });

  it.each(["../map.svg", "story/%2e%2e/map.svg", "story\\map.svg", "con.svg"])(
    "rejects unsafe authored map path: %s",
    (path) => {
      expect(
        parseChapterStoryDocument({
          ...story,
          mapImage: { ...story.mapImage, path },
        }),
      ).toEqual(invalid);
    },
  );

  it("rejects incomplete choices and duplicate beats without repairing data", () => {
    expect(
      parseChapterStoryDocument({ ...story, choices: story.choices.slice(1) }),
    ).toEqual(invalid);
    expect(
      parseChapterStoryDocument({
        ...story,
        beats: [...story.beats, ...story.beats],
      }),
    ).toEqual(invalid);
  });

  it("rejects unknown fields, cycles and accessors without invoking them", () => {
    expect(parseChapterSelections({ ...selections, extra: true })).toEqual(
      invalid,
    );
    expect(parseChapterStoryDocument({ ...story, extra: true })).toEqual(
      invalid,
    );
    const cycle: Record<string, unknown> = { ...story };
    cycle.beats = [cycle];
    expect(parseChapterStoryDocument(cycle)).toEqual(invalid);
    let reads = 0;
    const accessor = Object.defineProperty({ ...story }, "title", {
      enumerable: true,
      get() {
        reads++;
        return "Title";
      },
    });
    expect(parseChapterStoryDocument(accessor)).toEqual(invalid);
    expect(reads).toBe(0);
  });

  it("rejects oversized input before whole-body encoding", () => {
    expect(
      parseChapterSelections({
        ...selections,
        sourceSha256: "x".repeat(1048576),
      }),
    ).toEqual(invalid);
    expect(
      parseChapterStoryDocument({ ...story, title: "x".repeat(4194304) }),
    ).toEqual(invalid);
  });
});
