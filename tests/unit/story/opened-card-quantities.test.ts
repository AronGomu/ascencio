import { describe, expect, it } from "vitest";
import { groupOpenedCards } from "../../../src/story/shop/opened-card-quantities.ts";
import { PACK_SIZE } from "../../../src/story/shop/data/shop-pricing.ts";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";

/* Six packs repeat cards; the results list shows one tile per card and a
   count. This is the counting, with no screen around it. */

function pull(code: number, name: string, rarity: ShopRarity = "common") {
  return { code, name, imageUrl: null, rarity };
}

describe("groupOpenedCards", () => {
  it("collapses repeats of one code into a single entry with a quantity", () => {
    const grouped = groupOpenedCards([
      pull(1, "Kuriboh"),
      pull(2, "Sangan", "rare"),
      pull(1, "Kuriboh"),
      pull(1, "Kuriboh"),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      code: 1,
      rarity: "common",
      quantity: 3,
    });
    expect(grouped[1]).toMatchObject({ code: 2, rarity: "rare", quantity: 1 });
  });

  it("gives a card pulled once a quantity of one", () => {
    expect(groupOpenedCards([pull(7, "Raigeki")])[0]!.quantity).toBe(1);
  });

  /* Pull order, not alphabetical: the ungrouped results list reads as the
     cards came out of the packs, the way the set list reads in set order. The
     rarity grouping is what re-sorts it, and it does that itself. */
  it("keeps the order each code was first pulled in", () => {
    const grouped = groupOpenedCards([
      pull(30, "Zombyra"),
      pull(10, "Alpha"),
      pull(30, "Zombyra"),
      pull(20, "Mystical Elf"),
    ]);
    expect(grouped.map(({ code }) => code)).toEqual([30, 10, 20]);
  });

  /* The results list draws a tile and sorts it inside a rarity group, and
     `groupByRarity` sorts by name — so whatever the caller knows about a card
     has to survive the count. */
  it("carries the rest of the card through", () => {
    const grouped = groupOpenedCards([
      {
        code: 5,
        name: "Dark Magician",
        imageUrl: "/art/5.jpg",
        rarity: "ultra-rare" as ShopRarity,
      },
    ]);
    expect(grouped[0]).toEqual({
      code: 5,
      name: "Dark Magician",
      imageUrl: "/art/5.jpg",
      rarity: "ultra-rare",
      quantity: 1,
    });
  });

  it("accounts for every opened card", () => {
    /* Three packs of nine, drawn from a pool of four codes, so almost every
       tile carries a count above one. */
    const codes = [11, 22, 33, 44];
    const cards = Array.from({ length: 3 * PACK_SIZE }, (_, index) =>
      pull(
        codes[index % codes.length]!,
        `Card ${codes[index % codes.length]!}`,
      ),
    );

    const total = groupOpenedCards(cards).reduce(
      (sum, { quantity }) => sum + quantity,
      0,
    );
    expect(total).toBe(3 * PACK_SIZE);
  });

  it("counts nothing into nothing", () => {
    expect(groupOpenedCards([])).toEqual([]);
  });

  /* The screen re-groups the same input whenever the rarity button is
     cycled, so a pass that reordered the source would corrupt the next one. */
  it("leaves the array it was handed untouched", () => {
    const source = [pull(2, "B"), pull(1, "A"), pull(2, "B")];
    const before = [...source];
    groupOpenedCards(source);
    expect(source).toEqual(before);
  });
});
