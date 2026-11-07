import { describe, expect, it } from "vitest";
import { cardCode } from "../../../src/cards/index.ts";
import type { StorySet } from "../../../src/story/ports/story-release.ts";
import { installedShopSetData } from "../../../src/story/shop/data/shop-set-data.ts";
import { expectedPackResale } from "../../../src/story/shop/data/pack-generator.ts";
import { SELL_PRICE_DP } from "../../../src/story/shop/data/shop-pricing.ts";
import { mutableStoryRelease } from "../../fixtures/story-release.ts";

function card(
  code: number,
  rarity: StorySet["cards"][number]["rarity"],
  sourceRarity: string,
) {
  return {
    code: cardCode(code),
    name: `Card ${code}`,
    rarity,
    sourceRarity,
    printingCode: `SET-${code}`,
    sourceRarityCode: rarity,
  };
}

function set(id: string, cards: StorySet["cards"]): StorySet {
  return { id, name: id, releaseYear: 2002, cards };
}

describe("installed shop economy", () => {
  it("folds parallel printings without changing installed provenance", () => {
    const release = mutableStoryRelease();
    const cards = [
      card(1, "rare", "Rare"),
      card(1, "ultimate-rare", "Ultimate Rare"),
    ];
    release.chapters[0]!.sets = [{ ...set("base", cards), cards }];
    const data = installedShopSetData(
      release.chapters.flatMap((chapter) => chapter.sets),
    );
    expect(data.sets[0]!.cards).toEqual([
      { code: 1, name: "Card 1", rarity: "rare" },
    ]);
    expect(data.sets[0]!.released).toBe(true);
    expect(release.chapters[0]!.sets[0]!.cards).toHaveLength(2);
  });

  it("keeps common-only packs but refuses empty or expensive promo packs", () => {
    const data = installedShopSetData([
      set("common", [card(1, "common", "Common")]),
      set("promo", [card(2, "secret-rare", "Secret Rare")]),
      set("empty", []),
    ]);
    expect(data.sets.map(({ released }) => released)).toEqual([
      true,
      false,
      false,
    ]);
    expect(
      expectedPackResale(
        data.sets[0]!.cards,
        ({ rarity }) => SELL_PRICE_DP[rarity],
      ),
    ).toBe(9);
    expect(
      expectedPackResale(
        data.sets[1]!.cards,
        ({ rarity }) => SELL_PRICE_DP[rarity],
      ),
    ).toBe(450);
  });

  it("prices eligibility against the same highest cross-set tier as selling", () => {
    const data = installedShopSetData([
      set("cheap", [card(1, "common", "Common")]),
      set("expensive", [card(1, "secret-rare", "Secret Rare")]),
    ]);
    expect(data.sets.every(({ released }) => !released)).toBe(true);
  });

  it("allows one DP tolerance around 20 DP and rejects the next increment", () => {
    const data = installedShopSetData([
      set("within", [
        card(1, "common", "Common"),
        card(2, "super-rare", "Super Rare"),
        card(3, "ultra-rare", "Ultra Rare"),
      ]),
      set("above", [
        card(4, "common", "Common"),
        card(5, "ultra-rare", "Ultra Rare"),
      ]),
    ]);
    expect(
      expectedPackResale(
        data.sets[0]!.cards,
        ({ rarity }) => SELL_PRICE_DP[rarity],
      ),
    ).toBe(20.5);
    expect(data.sets.map(({ released }) => released)).toEqual([true, false]);
  });
});
