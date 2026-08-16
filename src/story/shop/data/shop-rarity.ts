import type { ShopRarity } from "../../model/story-state.ts";
import type { DeckBuilderCardView } from "../../../decks/catalog/ocg-card-mapper.ts";

export interface ShopCardOffer {
  readonly code: number;
  readonly rarity: ShopRarity;
}

export function inferRarity(card: DeckBuilderCardView): ShopRarity {
  if (card.attack !== null && card.attack >= 3000) return "secret-rare";
  if (card.canonicalZone === "extra") return "ultra-rare";
  if (card.subtypes.includes("Ritual")) return "super-rare";
  if (card.attack !== null && card.attack >= 2000) return "super-rare";
  if (card.family !== "monster" && card.subtypes.length > 0) return "rare";
  if (
    card.family === "monster" &&
    card.subtypes.includes("Effect") &&
    card.levelRankLink !== null &&
    card.levelRankLink >= 5
  )
    return "rare";
  return "common";
}
