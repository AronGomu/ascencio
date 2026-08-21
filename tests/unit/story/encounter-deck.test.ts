import { afterEach, describe, expect, it } from "vitest";
import { catalogByCode } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { setRuntimeCatalogForTests } from "../../../src/decks/catalog/runtime-catalog.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { encounterDeck } from "../../../src/story/decks/encounter-deck.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import {
  fieldableStoryDeck,
  storyDeckFixture,
} from "../../fixtures/story-decks.ts";

/* The deck a story encounter actually hands the duel. `pre-battle-decks.ts`
   decides which decks the briefing offers; this decides what the chosen one
   becomes on the way to the engine, and the two have to agree — a deck the
   briefing refuses must never resolve here, or the gate is decoration. */

const FIELDABLE = fieldableStoryDeck();
const SOLD = catalogByCode(PROTOTYPE_CATALOG).get(FIELDABLE.deck.main[0]!)!;

afterEach(() => setRuntimeCatalogForTests(null));

function save(overrides: Partial<StoryState> = {}): StoryState {
  setRuntimeCatalogForTests(PROTOTYPE_CATALOG);
  return {
    ...createInitialStoryState(),
    screen: "pre-battle",
    progressExists: true,
    collection: FIELDABLE.collection,
    decks: [FIELDABLE.deck],
    defaultDeckId: FIELDABLE.deck.id,
    ...overrides,
  };
}

describe("the deck a story encounter is fought with", () => {
  it("is the deck the save chose, card for card", async () => {
    const deck = await encounterDeck(save());

    expect(deck?.ref).toEqual({
      type: "local",
      deckId: FIELDABLE.deck.id,
      revision: FIELDABLE.deck.revision,
    });
    expect(deck?.name).toBe(FIELDABLE.deck.name);
    expect(deck?.main).toEqual(FIELDABLE.deck.main);
    expect(deck?.extra).toEqual([]);
    expect(deck?.side).toEqual([]);
    expect(deck?.validationDigest).toMatch(/^fnv1a-/);
  });

  /* The property this slice exists for. The snapshot is what the Worker plays,
     so resolving it without the save's own ownership would hand the engine
     cards this save sold — past a briefing that had already refused them. */
  it("is never a deck whose cards the save no longer owns", async () => {
    const deck = await encounterDeck(
      save({ collection: { ...FIELDABLE.collection, [SOLD.code]: 0 } }),
    );

    expect(deck).toBeNull();
  });

  /* The granted starter deck has no Extra and no Side deck, so it validates to
     warnings. Illegal means errors: a fresh save has to be able to fight its
     first encounter with the only deck it owns. */
  it("is resolved for a deck that only warns", async () => {
    const deck = await encounterDeck(save());

    expect(deck).not.toBeNull();
    expect(deck?.extra).toEqual([]);
  });

  it("is nothing when the save's default names a deck it no longer has", async () => {
    await expect(
      encounterDeck(save({ defaultDeckId: "deleted" })),
    ).resolves.toBeNull();
  });

  it("is nothing when the save has no default at all", async () => {
    await expect(
      encounterDeck(save({ defaultDeckId: null })),
    ).resolves.toBeNull();
  });

  it("is nothing when the chosen deck breaks a build rule", async () => {
    const short = storyDeckFixture("short", {
      main: [FIELDABLE.deck.main[0]!],
    });

    await expect(
      encounterDeck(save({ decks: [short], defaultDeckId: short.id })),
    ).resolves.toBeNull();
  });

  /* The verdict cached on the record was computed with an empty catalog —
     `starter-grant.ts` writes `errors` into every new save for that reason — so
     reading it back instead of recomputing would refuse a first-time player's
     only deck. */
  it("recomputes rather than trusting the verdict stored on the save", async () => {
    const stale = storyDeckFixture("stale", {
      main: [...FIELDABLE.deck.main],
      validation: {
        status: "errors",
        issues: [
          {
            id: "missing-card:deck-1",
            code: "missing-card",
            severity: "error",
            message: "Card 1 is missing from the pinned catalog.",
          },
        ],
        rulesetRevision: "prototype-2026-01",
      },
    });

    await expect(
      encounterDeck(save({ decks: [stale], defaultDeckId: stale.id })),
    ).resolves.not.toBeNull();
  });
});
