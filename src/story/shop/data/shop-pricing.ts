import type { ShopRarity } from "../../model/story-state.ts";

/* Must stay above a pack's expected sell value (≈138–142 DP across the three
   released sets: 8 commons + 1 rare-or-better against the ladder below), or
   buy → open → sell loops DP upward without bound. ADR-035 rev. 3. */
export const PACK_PRICE_DP = 150;
export const PACK_SIZE = 9;

export const SELL_PRICE_DP: Readonly<Record<ShopRarity, number>> = {
  common: 10,
  rare: 25,
  "super-rare": 50,
  "ultra-rare": 100,
  "secret-rare": 250,
  "ultimate-rare": 500,
  "ghost-rare": 1000,
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
