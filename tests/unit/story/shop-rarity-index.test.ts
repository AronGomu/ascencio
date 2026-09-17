import { describe, expect, it } from "vitest";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";
import {
  resolveCardRarity,
  type ShopSetCard,
  type ShopSetData,
} from "../../../src/story/shop/data/shop-set-data.ts";

function countedData(): {
  readonly data: ShopSetData;
  readonly reads: () => number;
} {
  let cardListReads = 0;
  const entry = (
    id: string,
    cards: readonly ShopSetCard[],
  ): ShopSetData["sets"][number] => ({
    id,
    name: id,
    releaseYear: 2002,
    released: true,
    get cards() {
      cardListReads += 1;
      return cards;
    },
  });
  return {
    data: {
      version: 1,
      sets: [
        entry("one", [
          { code: 1, name: "One", rarity: "common" },
          { code: 2, name: "Two", rarity: "rare" },
        ]),
        entry("two", [
          { code: 1, name: "One", rarity: "ultra-rare" },
          { code: 3, name: "Three", rarity: "secret-rare" },
        ]),
      ],
    },
    reads: () => cardListReads,
  };
}

describe("resolveCardRarity shop-data index", () => {
  it("indexes one shop-data snapshot once across collection lookups", () => {
    const { data, reads } = countedData();

    expect(resolveCardRarity(1, data, undefined)).toBe<ShopRarity>(
      "ultra-rare",
    );
    expect(resolveCardRarity(2, data, undefined)).toBe<ShopRarity>("rare");
    expect(resolveCardRarity(3, data, undefined)).toBe<ShopRarity>(
      "secret-rare",
    );

    expect(reads()).toBe(data.sets.length);
  });
});
