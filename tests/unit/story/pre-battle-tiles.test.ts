import { describe, expect, it } from "vitest";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { catalogByCode } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { preBattleDeckTile } from "../../../src/story/decks/pre-battle-tiles.ts";
import type { PreBattleDeckOption } from "../../../src/story/decks/pre-battle-decks.ts";
import type { StoryDeck } from "../../../src/story/model/story-state.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";

/* One save deck as the shared deck-selection screen renders it. The verdict is
   `pre-battle-decks.ts`'s and stays its; what is pinned here is that the tile
   carries the verdict rather than restating it — an illegal deck is listed
   with its reason on the tile, because a story's decks live in the save and a
   deck the player cannot see is a deck they cannot repair. */

const CATALOG = catalogByCode(PROTOTYPE_CATALOG);
const MAIN_CARDS = PROTOTYPE_CATALOG.filter(
  ({ canonicalZone }) => canonicalZone === "main",
);
const EXTRA_CARDS = PROTOTYPE_CATALOG.filter(
  ({ canonicalZone }) => canonicalZone === "extra",
);

function cardsOf(
  pool: readonly DeckBuilderCardView[],
  count: number,
): readonly number[] {
  return Array.from(
    { length: count },
    (_, index) => pool[index % pool.length]!.code,
  );
}

const RECORD: StoryDeck = storyDeckFixture("signal", {
  name: "Signal Deck",
  main: cardsOf(MAIN_CARDS, 40),
  extra: cardsOf(EXTRA_CARDS, 2),
  side: [],
  updatedAt: "2026-08-24T09:30:00.000Z",
});

const LEGAL: PreBattleDeckOption = {
  id: "signal",
  name: "Signal Deck",
  legal: true,
  issue: null,
};

const ILLEGAL: PreBattleDeckOption = {
  id: "signal",
  name: "Signal Deck",
  legal: false,
  issue: "Main deck has 39 cards; it needs 40.",
};

function context(
  overrides: Partial<Parameters<typeof preBattleDeckTile>[2]> = {},
) {
  return {
    catalog: CATALOG,
    defaultDeckId: null as string | null,
    ...overrides,
  };
}

describe("preBattleDeckTile", () => {
  it("maps an option and its record into one tile", () => {
    const tile = preBattleDeckTile(
      LEGAL,
      RECORD,
      context({ defaultDeckId: "signal" }),
    );

    expect(tile.key).toBe("signal");
    expect(tile.name).toBe("Signal Deck");
    expect(tile.counts).toEqual({ main: 40, extra: 2, side: 0 });
    /* The Extra deck's first card is the deck's face: a deck edited into
       another theme must not keep yesterday's cover. */
    expect(tile.coverImageUrl).toBe(
      CATALOG.get(RECORD.extra[0]!)?.imageUrl ?? null,
    );
    expect("favourite" in tile).toBe(false);
    expect(tile.isDefault).toBe(true);
    expect(tile.legal).toBe(true);
    expect(tile.blockReason).toBeNull();
    expect(tile.meta).toBe("Save deck");
    expect(tile.updatedAt).toBe("2026-08-24T09:30:00.000Z");
    /* A save's decks are managed in the story's own deck editor, and nothing
       here is bundled or owned by an AI opponent. */
    expect(tile.deletable).toBe(false);
    expect(tile.bundled).toBe(false);
    expect(tile.lockedBy).toBeNull();
  });

  it("carries an illegal deck's reason onto the tile", () => {
    const tile = preBattleDeckTile(ILLEGAL, RECORD, context());

    expect(tile.legal).toBe(false);
    expect(tile.blockReason).toBe(ILLEGAL.issue);
    /* The meta line is the one place a grid tile has for prose, so the reason
       takes it: an illegal deck says why on its own face. */
    expect(tile.meta).toBe(ILLEGAL.issue);
  });

  it("falls back to the Main deck's first card for a cover", () => {
    const noExtra = storyDeckFixture("signal", {
      main: cardsOf(MAIN_CARDS, 40),
      extra: [],
    });

    expect(preBattleDeckTile(LEGAL, noExtra, context()).coverImageUrl).toBe(
      CATALOG.get(noExtra.main[0]!)?.imageUrl ?? null,
    );
  });

  /* The verdicts and the records are two props of one screen and flush
     independently, so a tile has to survive the frame where a deck is in one
     list and not yet the other. */
  it("renders an option whose record has not arrived yet", () => {
    const tile = preBattleDeckTile(LEGAL, undefined, context());

    expect(tile.counts).toEqual({ main: 0, extra: 0, side: 0 });
    expect(tile.coverImageUrl).toBeNull();
    expect(tile.updatedAt).toBeNull();
    expect(tile.name).toBe("Signal Deck");
  });

  /* A code this build's catalog does not know still counts towards the deck;
     only its picture is missing. */
  it("leaves the cover empty for a card the catalog cannot name", () => {
    const unknown = storyDeckFixture("signal", { main: [1], extra: [] });

    expect(
      preBattleDeckTile(LEGAL, unknown, context()).coverImageUrl,
    ).toBeNull();
    expect(preBattleDeckTile(LEGAL, unknown, context()).counts.main).toBe(1);
  });
});
