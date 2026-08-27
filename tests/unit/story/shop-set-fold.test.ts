import { describe, expect, it } from "vitest";
import {
  foldPrintings,
  foldSetCards,
  type CardEntry,
} from "../../../scripts/lib/shop-set-fold.ts";

const SET = "Soul of the Duelist";

function entry(
  id: number,
  name: string,
  printings: readonly (readonly [string, string])[],
): CardEntry {
  return {
    id,
    name,
    card_sets: printings.map(([set_name, set_rarity]) => ({
      set_name,
      set_rarity,
    })),
  };
}

function rarityOf(
  cards: readonly CardEntry[],
  code: number,
): string | undefined {
  return foldSetCards(cards, SET).find((c) => c.code === code)?.rarity;
}

describe("shop set printing fold", () => {
  /* The whole point of audit F4: those sets reprint every non-common as an
     Ultimate Rare foil, and "highest wins" made the foil the set's price. */
  it("prefers the base printing over the set's ultimate-rare re-run", () => {
    const cards = [
      entry(1, "Cyber Dragon", [
        [SET, "Ultra Rare"],
        [SET, "Ultimate Rare"],
      ]),
    ];
    expect(rarityOf(cards, 1)).toBe("ultra-rare");
  });

  it("keeps a variant printing when the set printed nothing else", () => {
    const cards = [entry(2, "Foil Only", [[SET, "Ultimate Rare"]])];
    expect(rarityOf(cards, 2)).toBe("ultimate-rare");
  });

  it("still takes the highest tier among base printings", () => {
    const cards = [
      entry(3, "Two Tiers", [
        [SET, "Rare"],
        [SET, "Secret Rare"],
      ]),
    ];
    expect(rarityOf(cards, 3)).toBe("secret-rare");
  });

  it("ignores printings from other sets", () => {
    const cards = [
      entry(4, "Reprinted Elsewhere", [
        ["Metal Raiders", "Secret Rare"],
        [SET, "Common"],
      ]),
      entry(5, "Never In This Set", [["Metal Raiders", "Ultra Rare"]]),
    ];
    expect(rarityOf(cards, 4)).toBe("common");
    expect(rarityOf(cards, 5)).toBeUndefined();
  });

  it("maps parallel, gold and ghost printings down to a base tier", () => {
    expect(foldPrintings(["Gold Rare"])).toBe("ultra-rare");
    expect(foldPrintings(["Parallel Rare"])).toBe("rare");
    expect(foldPrintings(["Ultra Rare", "Ghost Rare"])).toBe("ultra-rare");
    expect(foldPrintings([])).toBeNull();
  });

  it("a set whose non-commons all carry an ultimate re-run keeps its ladder", () => {
    const cards = [
      entry(10, "C1", [[SET, "Common"]]),
      entry(11, "C2", [[SET, "Common"]]),
      entry(12, "C3", [[SET, "Common"]]),
      entry(13, "R", [
        [SET, "Rare"],
        [SET, "Ultimate Rare"],
      ]),
      entry(14, "S", [
        [SET, "Super Rare"],
        [SET, "Ultimate Rare"],
      ]),
      entry(15, "U", [
        [SET, "Ultra Rare"],
        [SET, "Ultimate Rare"],
      ]),
    ];
    const tiers = new Set(foldSetCards(cards, SET).map((c) => c.rarity));
    expect([...tiers].sort()).toEqual([
      "common",
      "rare",
      "super-rare",
      "ultra-rare",
    ]);
  });
});
