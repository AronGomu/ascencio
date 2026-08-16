import type { ShopRarity } from "../../model/story-state.ts";

export const PACK_PRICE_DP = 100;
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

export const SINGLE_PRICE_MULTIPLIER = 4;

export function singlePriceDp(rarity: ShopRarity): number {
  return SELL_PRICE_DP[rarity] * SINGLE_PRICE_MULTIPLIER;
}
