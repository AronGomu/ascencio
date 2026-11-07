import { describe, expect, it } from "vitest";
import {
  cardCode,
  createCards,
  type CardDefinition,
} from "../../../src/cards/index.ts";
import {
  PROTOTYPE_RULESET,
  validatePublishedDecks,
} from "../../../src/decks/validation/index.ts";

function card(scope: number): CardDefinition {
  const code = cardCode(1);
  return {
    code,
    alias: 0,
    setcodes: [],
    type: 17,
    level: 4,
    attribute: 1,
    race: "1",
    attack: 1000,
    defense: 1000,
    lscale: 0,
    rscale: 0,
    linkMarker: 0,
    scope,
    name: "Test card",
    description: "",
    strings: [],
    images: {
      full: { code, variant: "full" },
      cropped: { code, variant: "cropped" },
    },
  };
}

describe("published deck validation", () => {
  it("rejects cards marked unusable in a duel", () => {
    const deck = { main: [1], extra: [], side: [] };

    expect(() =>
      validatePublishedDecks([deck], createCards([card(1)]), PROTOTYPE_RULESET),
    ).not.toThrow();
    expect(() =>
      validatePublishedDecks([deck], createCards([card(8)]), PROTOTYPE_RULESET),
    ).toThrow("DECK_RELEASE_INVALID");
  });
});
