import { describe, expect, it } from "vitest";
import {
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { storyCardOwnership } from "../../../src/story/decks/card-ownership.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";

/* The story half of the ownership contract: what a save owns is what its
   collection says it owns, and nothing else in the save is consulted or
   changed by asking (ADR-050). */

function stateWith(collection: Readonly<Record<number, number>>): StoryState {
  return Object.freeze({ ...createInitialStoryState(), collection });
}

describe("story card ownership", () => {
  it("story ownership reports the collection count", () => {
    expect(storyCardOwnership(stateWith({ 4007: 2 })).ownedCount(4007)).toBe(2);
  });

  it("story ownership reports zero for a missing card", () => {
    expect(storyCardOwnership(stateWith({})).ownedCount(1)).toBe(0);
  });

  /* A save loaded from disk may carry an explicit zero rather than an absent
     key. Both mean "not owned", and the catalog filters on `> 0`. */
  it("story ownership reports zero for a card recorded at zero", () => {
    expect(storyCardOwnership(stateWith({ 4007: 0 })).ownedCount(4007)).toBe(0);
  });

  it("story ownership is not unlimited", () => {
    expect(storyCardOwnership(stateWith({ 4007: 2 })).isUnlimited).toBe(false);
  });

  it("ownership never mutates the state", () => {
    const state = stateWith({ 4007: 2 });
    const snapshot = structuredClone(state);
    const ownership = storyCardOwnership(state);
    ownership.ownedCount(4007);
    ownership.ownedCount(999);
    ownership.ownedCount(4007);
    expect(state).toEqual(snapshot);
    expect(state.collection).toEqual({ 4007: 2 });
  });

  /* A collection may hold more copies than any deck may run. Ownership reports
     what is there; the pinned ruleset is what caps the deck, and Raigeki is
     pinned to one. */
  it("ownership does not encode deck copy limits", () => {
    const hoarded = 12580477;
    const ownership = storyCardOwnership(stateWith({ [hoarded]: 9 }));
    expect(ownership.ownedCount(hoarded)).toBe(9);
    expect(quantityLimit(PROTOTYPE_RULESET, hoarded)).toBe(1);
    expect(
      Math.min(
        ownership.ownedCount(hoarded),
        quantityLimit(PROTOTYPE_RULESET, hoarded),
      ),
    ).toBe(1);
  });
});
