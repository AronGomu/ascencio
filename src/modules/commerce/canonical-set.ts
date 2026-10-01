import type { CommerceRarity } from "./rarity.ts";
export interface CanonicalSet {
  readonly id: string;
  readonly name: string;
  readonly releaseYear: number | null;
  readonly imageAssetPath: string | null;
  readonly cards: readonly {
    readonly cardCode: number;
    readonly printingCode: string;
    readonly rarity: CommerceRarity;
    readonly sourceRarity: string;
    readonly sourceRarityCode: string;
  }[];
}
