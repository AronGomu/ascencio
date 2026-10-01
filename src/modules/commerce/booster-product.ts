import type { CommerceRarity } from "./rarity.ts";
export interface BoosterProduct {
  readonly id: string;
  readonly name: string;
  readonly setId: string;
  readonly replacement: "with";
  readonly slots: readonly {
    readonly count: number;
    /** Per-card weights: equal weights preserve uniform selection across the pool. */
    readonly rarities: readonly {
      readonly rarity: CommerceRarity;
      readonly weight: number;
    }[];
    readonly fallback: "all";
  }[];
}
