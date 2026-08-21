import { describe, expect, it } from "vitest";
import {
  deckBuildableCards,
  isDeckBuildableCard,
} from "../../../src/decks/catalog/deck-buildable-cards.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { SHEEP_TOKEN, SHEEP_TOKEN_CODE } from "../../fixtures/token-card.ts";

describe("deck-buildable cards", () => {
  it("rejects a Token", () => {
    expect(isDeckBuildableCard(SHEEP_TOKEN)).toBe(false);
  });

  it("accepts every card of the packaged fixture catalog", () => {
    expect(PROTOTYPE_CATALOG.every(isDeckBuildableCard)).toBe(true);
  });

  it("drops Tokens from the catalog an editor may offer", () => {
    const offered = deckBuildableCards([...PROTOTYPE_CATALOG, SHEEP_TOKEN]);
    expect(offered.map(({ code }) => code)).not.toContain(SHEEP_TOKEN_CODE);
    expect(offered).toHaveLength(PROTOTYPE_CATALOG.length);
  });
});
