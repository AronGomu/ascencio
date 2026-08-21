import { describe, expect, it } from "vitest";
import {
  EMPTY_CATALOG_FILTERS,
  filterDeckCatalog,
} from "../../../src/decks/catalog/deck-catalog.ts";
import {
  buildDeckCatalogIndex,
  filterDeckCatalogIndex,
} from "../../../src/decks/catalog/deck-catalog-index.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { syntheticCatalog } from "../../fixtures/synthetic-catalog.ts";

const SIX_FILTER_COMBOS = [
  EMPTY_CATALOG_FILTERS,
  { ...EMPTY_CATALOG_FILTERS, name: "blue-eyes" },
  { ...EMPTY_CATALOG_FILTERS, family: "monster" as const },
  { ...EMPTY_CATALOG_FILTERS, family: "spell" as const },
  { ...EMPTY_CATALOG_FILTERS, family: "monster" as const, attribute: "DARK" },
  {
    ...EMPTY_CATALOG_FILTERS,
    family: "monster" as const,
    subtype: "Normal",
    attribute: "DARK",
    race: "Dragon",
  },
];

describe("deck-catalog-index", () => {
  describe("differential: filterDeckCatalogIndex matches filterDeckCatalog", () => {
    const cards = syntheticCatalog(14_794);
    const index = buildDeckCatalogIndex(cards);

    for (const filters of SIX_FILTER_COMBOS) {
      it(`filters: ${JSON.stringify(filters)}`, () => {
        expect([...filterDeckCatalogIndex(index, filters)]).toEqual([
          ...filterDeckCatalog(cards, filters),
        ]);
      });
    }
  });

  describe("small-fixture parity (mirrors deck-catalog.test.ts)", () => {
    const index = buildDeckCatalogIndex(PROTOTYPE_CATALOG);

    it("filters case-insensitive names", () => {
      expect(
        filterDeckCatalogIndex(index, {
          ...EMPTY_CATALOG_FILTERS,
          name: "blue-eyes",
        }).map(({ name }) => name),
      ).toEqual(["Blue-Eyes White Dragon"]);
    });

    it("intersects family, subtype, attribute, and race", () => {
      const result = filterDeckCatalogIndex(index, {
        name: "",
        family: "monster",
        subtype: "Normal",
        attribute: "DARK",
        race: "Dragon",
      });
      expect(result.length).toBeGreaterThan(0);
      for (const card of result) {
        expect(card.family).toBe("monster");
        expect(card.subtypes).toContain("Normal");
        expect(card.attribute).toBe("DARK");
        expect(card.race).toBe("Dragon");
      }
    });

    it("returns empty for impossible query", () => {
      expect(
        filterDeckCatalogIndex(index, {
          ...EMPTY_CATALOG_FILTERS,
          name: "not-a-card",
        }),
      ).toEqual([]);
    });
  });
});
