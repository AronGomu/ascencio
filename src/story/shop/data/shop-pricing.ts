import type { ShopRarity } from "../../model/story-state.ts";

/* Owner pricing: 100 DP packs, roughly 20 DP expected resale for ordinary
   boosters. Installed sets must also pass the resale eligibility gate. */
export const PACK_PRICE_DP = 100;
export const PACK_SIZE = 9;
/* One DP tolerance keeps ordinary boosters near the owner's 20 DP target. */
export const MAX_PACK_RESALE_DP = 21;

export const SELL_PRICE_DP: Readonly<Record<ShopRarity, number>> = {
  common: 1,
  rare: 2,
  "super-rare": 5,
  "ultra-rare": 20,
  "secret-rare": 50,
  "ultimate-rare": 50,
  "ghost-rare": 50,
};

/* Derived from the price table rather than listed a second time: a rarity the
   shop cannot price is a rarity no command may name. A forged or stale value
   priced `undefined` turns the wallet into `NaN`, which no later comparison
   can reject. */
export function isShopRarity(value: unknown): value is ShopRarity {
  return typeof value === "string" && Object.hasOwn(SELL_PRICE_DP, value);
}

export const SINGLE_PRICE_MULTIPLIER = 4;

export function singlePriceDp(rarity: ShopRarity): number {
  return SELL_PRICE_DP[rarity] * SINGLE_PRICE_MULTIPLIER;
}
