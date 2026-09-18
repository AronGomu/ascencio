// @vitest-environment node

import { describe, expect, it } from "vitest";
import { emptyDeckHistory } from "../../../src/decks/editing/index.ts";
import { createStoryDeckRepository } from "../../../src/story/decks/story-deck-repository.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import { storyDeckFixture as storyDeck } from "../../fixtures/story-decks.ts";

const NOW = new Date("2026-09-01T12:00:00.000Z");

describe("story deck repository concurrency", () => {
  it("rejects a save queued with a revision consumed by an in-flight save", async () => {
    let state: StoryState = {
      ...createInitialStoryState(),
      decks: [storyDeck("alpha", { revision: 4 })],
    };
    let releaseFirstPersist: () => void = () => {};
    let firstPersistReached: () => void = () => {};
    const firstPersistStarted = new Promise<void>((resolve) => {
      firstPersistReached = resolve;
    });
    const firstPersistBlocked = new Promise<void>((resolve) => {
      releaseFirstPersist = resolve;
    });
    const repository = createStoryDeckRepository({
      readState: () => state,
      dispatch: (command) => {
        state = reduceStory(state, command);
      },
      restore: (previous) => {
        state = previous;
      },
      persist: () => {
        firstPersistReached();
        return firstPersistBlocked;
      },
      now: () => NOW,
    });

    const first = repository.save(
      4,
      storyDeck("alpha", { revision: 4, name: "First edit" }),
      emptyDeckHistory(),
    );
    const stale = repository.save(
      4,
      storyDeck("alpha", { revision: 4, name: "Stale edit" }),
      emptyDeckHistory(),
    );
    await firstPersistStarted;
    releaseFirstPersist();

    await expect(first).resolves.toMatchObject({
      deck: { revision: 5, name: "First edit" },
    });
    await expect(stale).rejects.toMatchObject({
      name: "DeckRevisionConflictError",
      actualRevision: 5,
    });
    expect(state.decks[0]).toMatchObject({
      revision: 5,
      name: "First edit",
    });
  });
});
