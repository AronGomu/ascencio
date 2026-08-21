import type { CardOwnership } from "../../decks/card-ownership.ts";
import type { StoryState } from "../model/story-state.ts";

/** What one save owns, read straight off its collection.

    Bound to the state object handed in, not to a store. `StoryState` is
    immutable — a reducer hands back a new one rather than editing the old —
    so the reader returned here keeps answering for the save as it stood when
    it was built, which is the ownership snapshot validation needs (ADR-050).
    A caller that mutates a collection in place instead breaks that, and every
    other reader of the state with it. */
export function storyCardOwnership(state: StoryState): CardOwnership {
  const { collection } = state;
  return Object.freeze({
    ownedCount: (code: number) => collection[code] ?? 0,
    isUnlimited: false,
  });
}
