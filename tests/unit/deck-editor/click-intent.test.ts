import { describe, expect, it } from "vitest";
import {
  catalogCardClickIntent,
  deckCardClickIntent,
  type ZoneCounts,
} from "../../../src/deck-editor/layout/click-intent.ts";

const EMPTY: ZoneCounts = { main: 0, extra: 0, side: 0 };

function counts(overrides: Partial<ZoneCounts>): ZoneCounts {
  return { ...EMPTY, ...overrides };
}

describe("deckCardClickIntent", () => {
  it("a main-deck click sends the card to the side deck", () => {
    expect(deckCardClickIntent("main", "main", counts({ main: 40 }))).toEqual({
      kind: "move",
      to: "side",
    });
  });

  it("a full side deck blocks the move", () => {
    expect(
      deckCardClickIntent("main", "main", counts({ main: 40, side: 15 })),
    ).toEqual({ kind: "blocked", reason: "Side Deck is full." });
  });

  it("an extra-deck click removes the card", () => {
    expect(deckCardClickIntent("extra", "extra", counts({ extra: 3 }))).toEqual(
      {
        kind: "remove",
      },
    );
  });

  it("a side-deck click returns the card to its zone", () => {
    expect(
      deckCardClickIntent("side", "extra", counts({ extra: 3, side: 1 })),
    ).toEqual({ kind: "move", to: "extra" });
  });

  it("a full canonical zone blocks the return", () => {
    expect(
      deckCardClickIntent("side", "extra", counts({ extra: 15, side: 1 })),
    ).toEqual({ kind: "blocked", reason: "Extra Deck is full." });
  });
});

describe("catalogCardClickIntent", () => {
  it("a catalog click adds to the canonical zone", () => {
    expect(catalogCardClickIntent("main", counts({ main: 10 }), false)).toEqual(
      {
        kind: "add",
        zone: "main",
      },
    );
  });

  it("a full main deck sends the catalog click to the side", () => {
    expect(catalogCardClickIntent("main", counts({ main: 60 }), false)).toEqual(
      {
        kind: "add",
        zone: "side",
      },
    );
  });

  it("both full blocks the add", () => {
    expect(
      catalogCardClickIntent("main", counts({ main: 60, side: 15 }), false),
    ).toEqual({ kind: "blocked", reason: "No space left." });
  });

  it("the sideboard flag adds to the side first", () => {
    expect(catalogCardClickIntent("main", EMPTY, true)).toEqual({
      kind: "add",
      zone: "side",
    });
  });

  it("the sideboard flag falls back when the side is full", () => {
    expect(catalogCardClickIntent("main", counts({ side: 15 }), true)).toEqual({
      kind: "add",
      zone: "main",
    });
  });
});
