import { describe, expect, it } from "vitest";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import { inferRarity } from "../../../src/story/shop/data/shop-rarity.ts";
import {
  SELL_PRICE_DP,
  singlePriceDp,
} from "../../../src/story/shop/data/shop-pricing.ts";
import {
  generatePack,
  openablePicks,
  openBoosters,
} from "../../../src/story/shop/data/pack-generator.ts";
import type { ShopCardOffer } from "../../../src/story/shop/data/shop-rarity.ts";

function fakeCard(
  partial: Pick<
    DeckBuilderCardView,
    "family" | "subtypes" | "attack" | "levelRankLink" | "canonicalZone"
  > & { code?: number },
): DeckBuilderCardView {
  return {
    code: partial.code ?? 0,
    name: "",
    description: "",
    family: partial.family,
    subtypes: partial.subtypes,
    attribute: null,
    race: null,
    levelRankLink: partial.levelRankLink,
    ratingLabel: null,
    attack: partial.attack,
    defense: null,
    pendulumScales: null,
    linkMarkers: [],
    canonicalZone: partial.canonicalZone,
    imageUrl: null,
    scope: 0,
    rawType: 0,
  };
}

describe("shop data contracts", () => {
  it("rarity fallback rules fire in order", () => {
    const cases: [ReturnType<typeof fakeCard>, string][] = [
      // rule 1: attack >= 3000
      [
        fakeCard({
          family: "monster",
          subtypes: [],
          attack: 3000,
          levelRankLink: 3,
          canonicalZone: "main",
        }),
        "secret-rare",
      ],
      // rule 2: extra deck (fusion 2500 ATK — does not hit rule 1)
      [
        fakeCard({
          family: "monster",
          subtypes: ["Fusion"],
          attack: 2500,
          levelRankLink: 6,
          canonicalZone: "extra",
        }),
        "ultra-rare",
      ],
      // rule 3: ritual (attack < 2000, main deck)
      [
        fakeCard({
          family: "monster",
          subtypes: ["Ritual"],
          attack: 1500,
          levelRankLink: 6,
          canonicalZone: "main",
        }),
        "super-rare",
      ],
      // rule 4: attack >= 2000, non-ritual, main deck
      [
        fakeCard({
          family: "monster",
          subtypes: ["Effect"],
          attack: 2100,
          levelRankLink: 4,
          canonicalZone: "main",
        }),
        "super-rare",
      ],
      // rule 5: spell with subtype
      [
        fakeCard({
          family: "spell",
          subtypes: ["Continuous"],
          attack: null,
          levelRankLink: null,
          canonicalZone: "main",
        }),
        "rare",
      ],
      // rule 6: monster + Effect + level >= 5
      [
        fakeCard({
          family: "monster",
          subtypes: ["Effect"],
          attack: 1900,
          levelRankLink: 6,
          canonicalZone: "main",
        }),
        "rare",
      ],
      // rule 7: vanilla, no match
      [
        fakeCard({
          family: "monster",
          subtypes: ["Normal"],
          attack: 1200,
          levelRankLink: 3,
          canonicalZone: "main",
        }),
        "common",
      ],
    ];

    for (const [card, expected] of cases) {
      expect(inferRarity(card)).toBe(expected);
    }
  });

  it("sell prices ladder and singles are four times", () => {
    expect(SELL_PRICE_DP.common).toBe(10);
    expect(SELL_PRICE_DP["ghost-rare"]).toBe(1000);
    expect(singlePriceDp("common")).toBe(40);
    expect(singlePriceDp("secret-rare")).toBe(1000);
  });

  it("pack shape is eight commons plus one better", () => {
    const contents: readonly ShopCardOffer[] = [
      { code: 1, rarity: "common" },
      { code: 2, rarity: "common" },
      { code: 3, rarity: "rare" },
    ];
    // always picks index 0 from any pool
    const seq = Array(9).fill(0.0) as number[];
    const random = () => seq.shift()!;
    const pack = generatePack(contents, random);

    expect(pack).toHaveLength(9);
    expect(pack.slice(0, 8).every((c) => c.rarity === "common")).toBe(true);
    expect(pack.at(8)?.rarity).toBe("rare");
  });

  it("pack survives a pool with no commons", () => {
    const contents: readonly ShopCardOffer[] = [
      { code: 10, rarity: "rare" },
      { code: 11, rarity: "ultra-rare" },
    ];
    const seq = Array(9).fill(0.0) as number[];
    const random = () => seq.shift()!;
    const pack = generatePack(contents, random);

    expect(pack).toHaveLength(9);
  });

  /* A set with nothing in it is reachable from a tampered save and from a
     data file that drops a set. Opening one used to read past the end of an
     empty pool and throw mid-dispatch, which closed the dialog on an uncaught
     exception. The pick is skipped instead: no cards, no throw. */
  it("an empty set yields no cards instead of throwing", () => {
    expect(() => generatePack([], () => 0)).not.toThrow();
    expect(generatePack([], () => 0)).toHaveLength(0);
  });

  it("openBoosters skips picks whose set has no contents", () => {
    const aContents: readonly ShopCardOffer[] = [
      { code: 100, rarity: "common" },
      { code: 101, rarity: "rare" },
    ];
    const contentsOf = (setId: string) => (setId === "a" ? aContents : []);
    const picks = [
      { setId: "bogus", count: 3 },
      { setId: "a", count: 1 },
    ] as const;
    const seq = Array(9).fill(0.0) as number[];
    const random = () => seq.shift()!;

    const result = openBoosters(picks, contentsOf, random);

    expect(result).toHaveLength(9);
    expect(result.every((c) => c.code >= 100 && c.code <= 101)).toBe(true);
  });

  it("openablePicks drops the picks nothing can be opened from", () => {
    const contentsOf = (setId: string) =>
      setId === "a"
        ? ([{ code: 100, rarity: "common" }] as readonly ShopCardOffer[])
        : [];
    expect(
      openablePicks(
        [
          { setId: "bogus", count: 3 },
          { setId: "a", count: 2 },
        ],
        contentsOf,
      ),
    ).toEqual([{ setId: "a", count: 2 }]);
  });

  it("openBoosters honors pick counts and order", () => {
    const aContents: readonly ShopCardOffer[] = [
      { code: 100, rarity: "common" },
      { code: 101, rarity: "rare" },
    ];
    const bContents: readonly ShopCardOffer[] = [
      { code: 200, rarity: "common" },
      { code: 201, rarity: "ultra-rare" },
    ];
    const picks = [
      { setId: "a", count: 2 },
      { setId: "b", count: 1 },
    ] as const;
    const contentsOf = (setId: string) =>
      setId === "a" ? aContents : bContents;
    const seq = Array(27).fill(0.0) as number[];
    const random = () => seq.shift()!;

    const result = openBoosters(picks, contentsOf, random);

    expect(result).toHaveLength(27);
    expect(
      result.slice(0, 18).every((c) => c.code >= 100 && c.code <= 101),
    ).toBe(true);
    expect(result.slice(18).every((c) => c.code >= 200 && c.code <= 201)).toBe(
      true,
    );
  });
});
