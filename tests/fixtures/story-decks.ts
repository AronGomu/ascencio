import {
  deckId,
  type DeckValidationSummary,
} from "../../src/decks/deck-contracts.ts";
import type { StoryDeck } from "../../src/story/model/story-state.ts";

/* One deck as a story save holds it. Built as a literal rather than through
   `createBlankDeck`, because what the save layer and the reducer care about is
   the record's shape, not the catalogue it was drawn from — and a fixture that
   needs the pinned ruleset to name a second deck cannot give two of them
   distinct ids. */

const VALIDATION: DeckValidationSummary = Object.freeze({
  status: "valid",
  issues: Object.freeze([]),
  rulesetRevision: "test-ruleset",
});

export function storyDeckFixture(
  id: string,
  overrides: Partial<StoryDeck> = {},
): StoryDeck {
  return {
    schemaVersion: 1,
    id: deckId(id),
    revision: 1,
    name: `Deck ${id}`,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    main: [89631139],
    extra: [],
    side: [],
    validation: VALIDATION,
    importedNeedsReview: false,
    ...overrides,
  };
}
