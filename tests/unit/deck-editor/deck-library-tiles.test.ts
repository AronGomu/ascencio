import { describe, expect, it } from "vitest";
import { deckLibraryTiles } from "../../../src/deck-editor/components/deck-library-tiles.ts";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import {
  deckId,
  type DeckId,
  type DeckRecord,
  type DeckValidationIssue,
} from "../../../src/decks/deck-contracts.ts";

/* The library's own mapping, read without a DOM: what a stored deck looks like
   as the one tile every deck grid renders. The two halves the screen cannot
   answer for itself are here — which card's art fronts the tile, and what a
   deck that cannot be fielded says about why. */

const NOT_OWNED: DeckValidationIssue = {
  id: "not-owned:deck-89631139",
  severity: "error",
  code: "not-owned",
  message: "This deck uses 2 copy/copies of Blue-Eyes White Dragon; you own 1.",
  cardCode: 89631139,
};

const UNDER_MINIMUM: DeckValidationIssue = {
  id: "main-under-minimum",
  severity: "error",
  code: "main-under-minimum",
  message: "Main Deck needs 40 more card(s).",
  zone: "main",
};

const EMPTY_SIDE: DeckValidationIssue = {
  id: "empty-side",
  severity: "warning",
  code: "empty-side",
  message: "Side Deck is empty.",
  zone: "side",
};

function card(code: number, imageUrl: string | null): DeckBuilderCardView {
  return {
    code,
    name: `Card ${code}`,
    description: "",
    family: "monster",
    subtypes: [],
    attribute: null,
    race: null,
    levelRankLink: null,
    ratingLabel: null,
    attack: null,
    defense: null,
    pendulumScales: null,
    linkMarkers: [],
    canonicalZone: "main",
    imageUrl,
    scope: 0,
    rawType: 0,
  };
}

const CATALOG: ReadonlyMap<number, DeckBuilderCardView> = new Map([
  [111, card(111, "/runtime/images/111.jpg")],
  [222, card(222, "/runtime/images/222.jpg")],
  [333, card(333, null)],
]);

function record(overrides: Partial<DeckRecord> = {}): DeckRecord {
  return {
    schemaVersion: 1,
    id: deckId("d1"),
    revision: 1,
    name: "Prototype Control",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    main: [],
    extra: [],
    side: [],
    validation: { status: "valid", issues: [], rulesetRevision: "test" },
    importedNeedsReview: false,
    illustrationCardCode: null,
    ...overrides,
  };
}

const NO_MARKS = { defaultDeckId: null, favouriteDeckIds: [] } as const;

function tileOf(
  deck: DeckRecord,
  marks: {
    readonly defaultDeckId: DeckId | null;
    readonly favouriteDeckIds: readonly DeckId[];
  } = NO_MARKS,
) {
  return deckLibraryTiles([deck], CATALOG, marks)[0]!;
}

describe("deckLibraryTiles", () => {
  it("record maps to cropped art from first extra", () => {
    const tile = tileOf(record({ extra: [111], main: [222] }));

    expect(tile.coverImageUrl).toBe("/runtime/images-cropped/111.jpg");
  });

  it("uses the selected illustration card instead of the automatic cover", () => {
    expect(
      tileOf(
        record({
          main: [222],
          extra: [111],
          illustrationCardCode: 222,
        }),
      ).coverImageUrl,
    ).toBe("/runtime/images-cropped/222.jpg");
  });

  it("a missing selected card falls back to first Extra then first Main", () => {
    expect(
      tileOf(
        record({
          main: [222],
          extra: [111],
          illustrationCardCode: 999,
        }),
      ).coverImageUrl,
    ).toBe("/runtime/images-cropped/111.jpg");
    expect(tileOf(record({ main: [222, 111] })).coverImageUrl).toBe(
      "/runtime/images-cropped/222.jpg",
    );
  });

  it("a deck with no cards, or one the catalog cannot picture, has no cover", () => {
    expect(tileOf(record()).coverImageUrl).toBeNull();
    expect(tileOf(record({ main: [333] })).coverImageUrl).toBeNull();
    expect(tileOf(record({ main: [999] })).coverImageUrl).toBeNull();
  });

  it("the key, name, counts and timestamp come straight off the record", () => {
    const tile = tileOf(
      record({ main: [111, 222], extra: [111], side: [222, 111, 333] }),
    );

    expect(tile.key).toBe("d1");
    expect(tile.name).toBe("Prototype Control");
    expect(tile.counts).toEqual({ main: 2, extra: 1, side: 3 });
    expect(tile.updatedAt).toBe("2026-08-20T10:00:00.000Z");
  });

  it("a legal deck is legal, unblocked, and reports when it was last touched", () => {
    const tile = tileOf(
      record({
        validation: {
          status: "warnings",
          issues: [EMPTY_SIDE],
          rulesetRevision: "test",
        },
      }),
    );

    expect(tile.legal).toBe(true);
    expect(tile.blockReason).toBeNull();
    expect(tile.meta).toBe(
      `Updated ${new Date("2026-08-20T10:00:00.000Z").toLocaleString()}`,
    );
  });

  /* A deck whose cards the save no longer owns is repaired in the shop; one
     that breaks a build rule is repaired in the editor, and "Illegal" on its
     own would send a player who never touched the deck looking for a mistake
     they did not make (ADR-050). */
  it("errors record maps illegal with ownership-aware label", () => {
    const tile = tileOf(
      record({
        validation: {
          status: "errors",
          issues: [NOT_OWNED],
          rulesetRevision: "test",
        },
      }),
    );

    expect(tile.legal).toBe(false);
    expect(tile.blockReason).toBe("Cards not owned");
    expect(tile.meta).toBe("Cards not owned");
  });

  it("a build-rule error is blocked without blaming ownership", () => {
    expect(
      tileOf(
        record({
          validation: {
            status: "errors",
            issues: [UNDER_MINIMUM],
            rulesetRevision: "test",
          },
        }),
      ).blockReason,
    ).toBe("Illegal");
  });

  /* Buying the card back would not make this deck legal, so the tile must not
     promise that it would. */
  it("a deck short of cards and of a build rule is not blamed on ownership", () => {
    expect(
      tileOf(
        record({
          validation: {
            status: "errors",
            issues: [NOT_OWNED, UNDER_MINIMUM],
            rulesetRevision: "test",
          },
        }),
      ).blockReason,
    ).toBe("Illegal");
  });

  it("a warning alongside the ownership error keeps the ownership wording", () => {
    expect(
      tileOf(
        record({
          validation: {
            status: "errors",
            issues: [NOT_OWNED, EMPTY_SIDE],
            rulesetRevision: "test",
          },
        }),
      ).blockReason,
    ).toBe("Cards not owned");
  });

  it("the default and the favourites are the host's marks, not the record's", () => {
    const plain = tileOf(record());
    expect(plain.isDefault).toBe(false);
    expect(plain.favourite).toBe(false);

    const marked = tileOf(record(), {
      defaultDeckId: deckId("d1"),
      favouriteDeckIds: [deckId("d1")],
    });
    expect(marked.isDefault).toBe(true);
    expect(marked.favourite).toBe(true);
  });

  /* Every deck in this library was built by the player in this library: none
     ships with the app, none belongs to an AI, and all of them can be thrown
     away. */
  it("a local deck is never bundled or locked, and is always deletable", () => {
    const tile = tileOf(record());

    expect(tile.bundled).toBe(false);
    expect(tile.lockedBy).toBeNull();
    expect(tile.deletable).toBe(true);
  });

  it("the whole library maps in the order it was handed over", () => {
    const tiles = deckLibraryTiles(
      [
        record({ id: deckId("a"), name: "Alpha" }),
        record({ id: deckId("b"), name: "Bravo" }),
      ],
      CATALOG,
      NO_MARKS,
    );

    expect(tiles.map(({ key }) => key)).toEqual(["a", "b"]);
    expect(tiles.map(({ name }) => name)).toEqual(["Alpha", "Bravo"]);
  });
});
