import {
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../src/decks/catalog/pinned-ruleset.ts";
import {
  deckId,
  type DeckValidationSummary,
} from "../../src/decks/deck-contracts.ts";
import { PROTOTYPE_CATALOG } from "../../src/deck-editor/fixtures/catalog.ts";
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
    illustrationCardCode: null,
    ...overrides,
  };
}

/* Forty cards the pinned ruleset allows three copies of, drawn from the
   prototype catalog so a jsdom test can hold the whole card database in
   memory. Nothing here breaks a build rule, which leaves ownership as the only
   thing that can turn the deck below illegal. */
const FIELDABLE_MAIN_CARDS = PROTOTYPE_CATALOG.filter(
  (card) =>
    card.canonicalZone === "main" &&
    quantityLimit(PROTOTYPE_RULESET, card.code) === 3,
);

/** The smallest save a story encounter can actually start from: one deck the
    pre-battle gate accepts, and the collection that owns every copy of it. */
export function fieldableStoryDeck(id = "story-fieldable-deck"): {
  readonly deck: StoryDeck;
  readonly collection: Record<number, number>;
} {
  const main = Array.from(
    { length: 40 },
    (_, index) =>
      FIELDABLE_MAIN_CARDS[index % FIELDABLE_MAIN_CARDS.length]!.code,
  );
  const collection: Record<number, number> = {};
  for (const code of main) collection[code] = (collection[code] ?? 0) + 1;
  return { deck: storyDeckFixture(id, { main }), collection };
}
