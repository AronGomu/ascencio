import type { CommerceRarity } from "./rarity.ts";
export interface EconomyPolicy {
  readonly id: string;
  readonly sellPrices: Readonly<Record<CommerceRarity, number>>;
  readonly singlesMultiplier: number;
  readonly maxPackResale: number;
}
