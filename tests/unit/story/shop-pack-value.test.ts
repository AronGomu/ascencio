import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RARITY_ORDER } from "../../../src/story/collection/group-by-rarity.ts";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";
import {
  parseShopSetData,
  type ShopSetCard,
  type ShopSetEntry,
} from "../../../src/story/shop/data/shop-set-data.ts";
import {
  PACK_PRICE_DP,
  PACK_SIZE,
  SELL_PRICE_DP,
} from "../../../src/story/shop/data/shop-pricing.ts";

const jsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../assets/content/card-library/authoring/shop-sets.v1.json",
);
const parsed = parseShopSetData(
  JSON.parse(readFileSync(jsonPath, "utf-8")) as unknown,
);
if (parsed === null)
  throw new Error(
    "assets/content/card-library/authoring/shop-sets.v1.json does not parse as ShopSetData",
  );
const { sets } = parsed;

/* What the sell screen actually pays for a code. `resolveCardRarity`
   (src/story/shop/data/shop-set-data.ts:103) takes the highest tier the code
   was printed at across *all* fifty sets, not the tier the set it came out of
   printed it at — so a gate that priced by the opened set's own tier would
   measure a quantity the shop never pays. The two agree today: no code in this
   corpus appears in two of the fifty sets, so the index changes no number now.
   It is what keeps the gate honest if a later set list ever overlaps. */
const bestByCode = new Map<number, ShopRarity>();
for (const set of sets) {
  for (const card of set.cards) {
    const current = bestByCode.get(card.code);
    if (
      current === undefined ||
      RARITY_ORDER.indexOf(card.rarity) > RARITY_ORDER.indexOf(current)
    ) {
      bestByCode.set(card.code, card.rarity);
    }
  }
}

/* Every card in `sets` is a key of the index by construction. */
const sellPriceOf = (card: ShopSetCard): number =>
  SELL_PRICE_DP[bestByCode.get(card.code)!];

/* Mirrors `generatePack` in src/story/shop/data/pack-generator.ts exactly,
   including both empty-pool fallbacks: PACK_SIZE - 1 uniform draws from the
   commons and one uniform draw from the rest. The pools split on the tier the
   *set* prints — that is what `contentsOf` hands the generator — while the
   money uses `sellPriceOf`, which is what the sell screen pays. */
function expectedSellValue(entry: ShopSetEntry): number {
  const { cards } = entry;
  if (cards.length === 0) return 0;
  const commons = cards.filter((c) => c.rarity === "common");
  const rarePlus = cards.filter((c) => c.rarity !== "common");
  const commonPool = commons.length > 0 ? commons : cards;
  const rarePlusPool = rarePlus.length > 0 ? rarePlus : cards;
  const mean = (pool: readonly ShopSetCard[]): number =>
    pool.reduce((n, c) => n + sellPriceOf(c), 0) / pool.length;
  return (PACK_SIZE - 1) * mean(commonPool) + mean(rarePlusPool);
}

describe("shipped set pack value", () => {
  /* The old generator kept a card's highest printing, and ten sets reprint
     every non-common as an Ultimate Rare foil, so those sets came out priced
     entirely at 500 DP a card. A set whose only non-common tier is the foil
     tier is that bug, whatever the numbers work out to. Audit F4, issue #4. */
  it("no set sells ultimate-rare as its only non-common tier", () => {
    for (const set of sets) {
      const tiers = new Set(
        set.cards.filter((c) => c.rarity !== "common").map((c) => c.rarity),
      );
      expect(
        tiers.size === 1 && tiers.has("ultimate-rare"),
        `set "${set.id}" prices every non-common at ultimate-rare`,
      ).toBe(false);
    }
  });

  /* Retained authoring data must obey the current ladder too. Native installed
     projections and their 20 DP target are covered in installed-shop-set-data. */
  it("every released set costs more per pack than the pack sells back for", () => {
    const released = sets.filter((s) => s.released);
    expect(released.length).toBeGreaterThan(0);
    for (const set of released) {
      const value = expectedSellValue(set);
      expect(
        value,
        `set "${set.id}" sells a pack back for ${value.toFixed(2)} DP`,
      ).toBeLessThan(PACK_PRICE_DP);
    }
  });
});
