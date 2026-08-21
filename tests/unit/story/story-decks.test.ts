import { describe, expect, it } from "vitest";
import { storyDeckFixture as storyDeck } from "../../fixtures/story-decks.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";

/* Decks live inside the story state beside the wallet and the collection, so
   the four commands below are economy changes like any other: they go through
   the reducer, they never mutate what they were handed, and a save taken after
   one carries the result (ADR-049). */

describe("story deck commands", () => {
  it("a new save starts with no decks", () => {
    const initial = createInitialStoryState();
    expect(initial.decks).toEqual([]);
    expect(initial.defaultDeckId).toBeNull();
  });

  it("deck-create appends a deck", () => {
    const initial = createInitialStoryState();
    const state = reduceStory(initial, {
      type: "deck-create",
      deck: storyDeck("alpha"),
    });
    expect(state.decks.map(({ id }) => id)).toEqual(["alpha"]);
    /* A new object, and the state it came from is left as it was: the story
       keeps the pre-command state on the stack whenever a checkpoint is being
       written. */
    expect(state).not.toBe(initial);
    expect(initial.decks).toEqual([]);

    const second = reduceStory(state, {
      type: "deck-create",
      deck: storyDeck("beta"),
    });
    expect(second.decks.map(({ id }) => id)).toEqual(["alpha", "beta"]);
  });

  /* Two decks under one id would make every replace-by-id and delete-by-id
     ambiguous, and the loser would be a deck the player built. Refusing costs
     the caller a retry; accepting costs a deck. */
  it("deck-create refuses an id that is already taken", () => {
    const state = reduceStory(createInitialStoryState(), {
      type: "deck-create",
      deck: storyDeck("alpha"),
    });
    expect(
      reduceStory(state, {
        type: "deck-create",
        deck: storyDeck("alpha", { name: "Impostor" }),
      }),
    ).toBe(state);
  });

  it("deck-save replaces by id and bumps nothing else", () => {
    const created = reduceStory(
      { ...createInitialStoryState(), dp: 640, collection: { 89631139: 3 } },
      { type: "deck-create", deck: storyDeck("alpha") },
    );
    const edited = storyDeck("alpha", {
      name: "Renamed",
      revision: 2,
      main: [46986414],
      updatedAt: "2026-08-21T00:00:00.000Z",
    });
    const saved = reduceStory(created, { type: "deck-save", deck: edited });
    expect(saved.decks).toEqual([edited]);
    expect(saved.dp).toBe(640);
    expect(saved.collection).toEqual({ 89631139: 3 });
    expect(saved.defaultDeckId).toBe(created.defaultDeckId);
  });

  it("deck-save keeps the deck where it was in the list", () => {
    let state = createInitialStoryState();
    for (const id of ["alpha", "beta", "gamma"])
      state = reduceStory(state, {
        type: "deck-create",
        deck: storyDeck(id),
      });
    const saved = reduceStory(state, {
      type: "deck-save",
      deck: storyDeck("beta", { name: "Renamed" }),
    });
    expect(saved.decks.map(({ id }) => id)).toEqual(["alpha", "beta", "gamma"]);
    expect(saved.decks[1]?.name).toBe("Renamed");
  });

  /* A save of a deck this state does not hold is an editor working from a list
     the save no longer has — a deck deleted in another tab, or a stale draft.
     Appending it would resurrect the deletion. */
  it("deck-save ignores an unknown id", () => {
    const state = reduceStory(createInitialStoryState(), {
      type: "deck-create",
      deck: storyDeck("alpha"),
    });
    expect(
      reduceStory(state, { type: "deck-save", deck: storyDeck("ghost") }),
    ).toBe(state);
  });

  it("deck-delete removes it and clears a stale default", () => {
    let state = reduceStory(createInitialStoryState(), {
      type: "deck-create",
      deck: storyDeck("alpha"),
    });
    state = reduceStory(state, { type: "deck-set-default", id: "alpha" });
    expect(state.defaultDeckId).toBe("alpha");

    const deleted = reduceStory(state, { type: "deck-delete", id: "alpha" });
    expect(deleted.decks).toEqual([]);
    expect(deleted.defaultDeckId).toBeNull();
  });

  it("deck-delete leaves a default that is not the deleted deck", () => {
    let state = createInitialStoryState();
    for (const id of ["alpha", "beta"])
      state = reduceStory(state, { type: "deck-create", deck: storyDeck(id) });
    state = reduceStory(state, { type: "deck-set-default", id: "beta" });

    const deleted = reduceStory(state, { type: "deck-delete", id: "alpha" });
    expect(deleted.decks.map(({ id }) => id)).toEqual(["beta"]);
    expect(deleted.defaultDeckId).toBe("beta");
    expect(reduceStory(deleted, { type: "deck-delete", id: "ghost" })).toBe(
      deleted,
    );
  });

  it("deck-set-default rejects an unknown id", () => {
    const state = reduceStory(createInitialStoryState(), {
      type: "deck-create",
      deck: storyDeck("alpha"),
    });
    expect(reduceStory(state, { type: "deck-set-default", id: "ghost" })).toBe(
      state,
    );
  });

  it("deck-set-default clears the default when given no id", () => {
    let state = reduceStory(createInitialStoryState(), {
      type: "deck-create",
      deck: storyDeck("alpha"),
    });
    state = reduceStory(state, { type: "deck-set-default", id: "alpha" });
    expect(
      reduceStory(state, { type: "deck-set-default", id: null }).defaultDeckId,
    ).toBeNull();
  });

  /* The deck list belongs to the save, so every other command has to carry it
     through untouched — and starting over has to drop it with the rest of the
     progress. */
  it("keeps the deck list across an unrelated command and drops it on reset", () => {
    let state = reduceStory(createInitialStoryState(), {
      type: "deck-create",
      deck: storyDeck("alpha"),
    });
    state = reduceStory(state, { type: "deck-set-default", id: "alpha" });
    const shopping = reduceStory(
      { ...state, screen: "shop-browse" },
      { type: "buy-packs", setId: "metal-raiders", count: 1 },
    );
    expect(shopping.decks).toEqual(state.decks);
    expect(shopping.defaultDeckId).toBe("alpha");

    const reset = reduceStory(shopping, { type: "reset" });
    expect(reset.decks).toEqual([]);
    expect(reset.defaultDeckId).toBeNull();
    /* A new game drops the old library too, but lands on the granted starter
       deck rather than on nothing — see `new-game-grant.test.ts`. */
    const restarted = reduceStory(shopping, { type: "new-game" });
    expect(restarted.decks.map(({ id }) => id)).not.toContain("alpha");
    expect(restarted.defaultDeckId).toBe(restarted.decks[0]?.id);
  });
});
