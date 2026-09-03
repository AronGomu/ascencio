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
  it("a deck-zone double-click removes the source copy", () => {
    expect(deckCardClickIntent()).toEqual({ kind: "remove" });
  });
});

describe("catalogCardClickIntent", () => {
  it("a catalog double-click adds to the canonical zone", () => {
    expect(catalogCardClickIntent("main", counts({ main: 10 }), false)).toEqual(
      {
        kind: "add",
        zone: "main",
      },
    );
  });

  it("a full canonical zone blocks instead of falling back to side", () => {
    expect(catalogCardClickIntent("main", counts({ main: 60 }), false)).toEqual(
      {
        kind: "blocked",
        reason: "Main Deck is full.",
      },
    );
  });

  it("the sideboard flag adds to the selected target", () => {
    expect(catalogCardClickIntent("main", EMPTY, true)).toEqual({
      kind: "add",
      zone: "side",
    });
  });

  it("a full selected sideboard target blocks instead of falling back", () => {
    expect(catalogCardClickIntent("main", counts({ side: 15 }), true)).toEqual({
      kind: "blocked",
      reason: "Side Deck is full.",
    });
  });
});
