import { describe, expect, it } from "vitest";
import {
  EMPTY_DECK_CATALOG_QUERY,
  advancedDeckCatalogOptions,
  type DeckCatalogQuery,
} from "../../../src/decks/catalog/deck-catalog.ts";
import {
  buildDeckCatalogIndex,
  filterDeckCatalogIndex,
} from "../../../src/decks/catalog/deck-catalog-index.ts";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";

const RITUAL_MONSTER = PROTOTYPE_CATALOG.find(
  (card) => card.family === "monster" && card.subtypes.includes("Ritual"),
)!;
const RITUAL_SPELL: DeckBuilderCardView = Object.freeze({
  ...PROTOTYPE_CATALOG.find((card) => card.family === "spell")!,
  code: 92_000_001,
  name: "Synthetic Ritual Spell",
  subtypes: Object.freeze(["Ritual"]),
});
const AVAILABLE = () => true;

function query(
  advanced: Partial<DeckCatalogQuery["advanced"]>,
): DeckCatalogQuery {
  return {
    ...EMPTY_DECK_CATALOG_QUERY,
    advanced: { ...EMPTY_DECK_CATALOG_QUERY.advanced, ...advanced },
  };
}

describe("Ritual catalog filters", () => {
  it("keeps Ritual summon frames separate from Ritual spell properties", () => {
    const cards = [RITUAL_SPELL, RITUAL_MONSTER];
    const index = buildDeckCatalogIndex(cards);

    expect(
      filterDeckCatalogIndex(
        index,
        query({ summonFrame: "Ritual" }),
        AVAILABLE,
      ).map(({ name }) => name),
    ).toEqual([RITUAL_MONSTER.name]);
    expect(
      filterDeckCatalogIndex(
        index,
        query({ spellProperty: "Ritual" }),
        AVAILABLE,
      ).map(({ name }) => name),
    ).toEqual([RITUAL_SPELL.name]);
    expect(advancedDeckCatalogOptions([RITUAL_SPELL])).toMatchObject({
      summonFrames: [],
      spellProperties: ["Ritual"],
    });
  });
});
