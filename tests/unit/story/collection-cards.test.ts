import { afterEach, describe, expect, it } from "vitest";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import { setRuntimeCatalogForTests } from "../../../src/decks/catalog/runtime-catalog.ts";
import {
  collectionRarityIndex,
  loadCollectionCatalog,
} from "../../../src/story/collection/collection-cards.ts";
import type { ShopSetData } from "../../../src/story/shop/data/shop-set-data.ts";

/* A collection is counts only, so the tier a card is shown at is resolved
   rather than stored: the shop's set data first, the card itself after
   (ADR-050). */

afterEach(() => setRuntimeCatalogForTests(null));

function card(code: number, name: string, attack: number): DeckBuilderCardView {
  return {
    code,
    name,
    description: `${name} card text`,
    family: "monster",
    subtypes: ["Normal"],
    attribute: "DARK",
    race: "Dragon",
    levelRankLink: 4,
    ratingLabel: "Level",
    attack,
    defense: 1000,
    pendulumScales: null,
    linkMarkers: [],
    canonicalZone: "main",
    imageUrl: null,
    scope: 3,
    rawType: 1,
  };
}

/** 4007 is printed twice at different tiers; 4009 is sold by no set at all. */
const SETS: ShopSetData = {
  version: 1,
  sets: [
    {
      id: "lob",
      name: "Legend of Blue-Eyes",
      releaseYear: 2002,
      released: true,
      cards: [
        { code: 4007, name: "Dark Magician", rarity: "rare" },
        { code: 4008, name: "Celtic Guardian", rarity: "common" },
      ],
    },
    {
      id: "sdy",
      name: "Starter Deck Yugi",
      releaseYear: 2002,
      released: true,
      cards: [{ code: 4007, name: "Dark Magician", rarity: "ultra-rare" }],
    },
  ],
};

const CARDS = [
  card(4007, "Dark Magician", 2500),
  card(4008, "Celtic Guardian", 1400),
  card(4009, "Blue-Eyes White Dragon", 3000),
];

describe("collectionRarityIndex", () => {
  it("shows a card at the highest tier it was ever printed at", () => {
    expect(collectionRarityIndex(CARDS, SETS).get(4007)).toBe("ultra-rare");
  });

  it("takes a single printing at the tier it was printed", () => {
    expect(collectionRarityIndex(CARDS, SETS).get(4008)).toBe("common");
  });

  /* `inferRarity` reads 3000 ATK as a secret rare, which is what a code no set
     sells has to fall back to. */
  it("infers the tier of a card no set sells", () => {
    expect(collectionRarityIndex(CARDS, SETS).get(4009)).toBe("secret-rare");
  });

  it("infers every tier when the set data could not be read", () => {
    const index = collectionRarityIndex(CARDS, null);
    expect(index.get(4007)).toBe("super-rare");
    expect(index.get(4008)).toBe("common");
    expect(index.get(4009)).toBe("secret-rare");
  });

  it("names every card handed in and nothing else", () => {
    expect([...collectionRarityIndex(CARDS, SETS).keys()].sort()).toEqual([
      4007, 4008, 4009,
    ]);
  });
});

describe("loadCollectionCatalog", () => {
  /* No Cache Storage here, so the shop read fails exactly as it would offline.
     The cards, the counts and the ordering all survive that; only the printed
     tiers are lost, so the screen still groups. */
  it("degrades to inferred rarities when the shop data cannot be read", async () => {
    setRuntimeCatalogForTests(CARDS);
    const { cards, rarityByCode } = await loadCollectionCatalog();
    expect(cards).toEqual(CARDS);
    expect(rarityByCode.get(4009)).toBe("secret-rare");
  });
});
