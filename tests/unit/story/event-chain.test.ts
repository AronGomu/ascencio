import { expect, it } from "vitest";
import { parseStoryDocument } from "../../../src/story/ports/story-document.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
const beat = (id: string) => ({
  id,
  speaker: null,
  kind: "narration",
  text: id,
  background: "arena",
  characters: [],
});
const document = {
  schemaVersion: 1,
  contentId: "mod-story",
  title: "Branch",
  beats: [beat("unused-order"), beat("entry"), beat("end")],
  choices: [{ id: "go", label: "Continue" }],
  choiceResponses: { go: "Yes" },
  laterAcknowledgments: { go: "Later" },
  chain: {
    schemaVersion: 1,
    entryBeatId: "entry",
    nodes: [
      { beatId: "entry", next: null, choices: [{ id: "go", target: "end" }] },
      { beatId: "end", next: null, choices: [] },
    ],
  },
};
it("validates stable entry, choice targets and terminals, and follows declared edges rather than array order", () => {
  const parsed = parseStoryDocument(document);
  const initial = {
    ...createInitialStoryState(),
    screen: "narrative" as const,
    narrativeIndex: 1,
  };
  expect(reduceStory(initial, { type: "advance", inputId: 1 }, parsed)).toBe(
    initial,
  );
  const chosen = reduceStory(initial, { type: "choose", choice: "go" }, parsed);
  expect(chosen.narrativeIndex).toBe(2);
  expect(chosen.visitedBeatIds).toEqual(["entry", "end"]);
  expect(
    reduceStory(chosen, { type: "advance", inputId: 2 }, parsed).screen,
  ).toBe("map");
});
it("refuses missing targets and closed cycles before gameplay", () => {
  expect(() =>
    parseStoryDocument({
      ...document,
      chain: { ...document.chain, entryBeatId: "missing" },
    }),
  ).toThrow();
  expect(() =>
    parseStoryDocument({
      ...document,
      chain: {
        ...document.chain,
        nodes: [{ beatId: "entry", next: "entry", choices: [] }],
      },
    }),
  ).toThrow();
});
