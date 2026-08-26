// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { DeckStorageError } from "../../../src/decks/deck-storage-errors.ts";
import { storyCardOwnership } from "../../../src/story/decks/card-ownership.ts";
import { createStoryDeckRepository } from "../../../src/story/decks/story-deck-repository.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";

/* The audit's false-success repro: a story create whose write the save refused
   used to be reported as created-and-saved, because the recovery probe read
   the deck back from the state the failed write had already mutated. With
   rollback in the repository the probe finds nothing and the editor reports
   the failure. */
describe("a create the story save refused", () => {
  it("is reported as a failure, not opened as saved", async () => {
    let state: StoryState = createInitialStoryState();
    const repository = createStoryDeckRepository({
      readState: () => state,
      dispatch: (command) => {
        state = reduceStory(state, command);
      },
      restore: (previous) => {
        state = previous;
      },
      persist: async () => {
        throw new DeckStorageError("Storage is full");
      },
    });
    const controller = new DeckBuilderController(
      repository,
      prototypeCatalogMap,
      PROTOTYPE_RULESET,
      storyCardOwnership(state),
    );
    await controller.initialize();

    expect(await controller.createDeck("Quota Deck")).toBe(false);
    const view = get(controller);
    expect(view.mode).toBe("error");
    expect(view.message).toBe("Deck could not be created: Storage is full");
    expect(view.saveState).not.toBe("saved");
    expect(state.decks).toEqual([]);
  });
});
