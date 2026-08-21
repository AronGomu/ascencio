import type { DeckBuilderCardView } from "./ocg-card-mapper.ts";
import { OCG_TYPE, hasOcgType } from "./ocg-mask.ts";

/**
 * Whether a card may sit in a deck list at all.
 *
 * The runtime catalog is the whole card database, and 243 of its entries are
 * Tokens: cards a duel creates on the field and no player ever draws. The duel
 * reads that same catalog to name a token it summons, so tokens stay in the
 * catalog and are excluded here instead — from what a deck may contain.
 */
export function isDeckBuildableCard(card: DeckBuilderCardView): boolean {
  return !hasOcgType(card.rawType, OCG_TYPE.TOKEN);
}

/** The catalog an editor may offer, with everything undeckable removed. */
export function deckBuildableCards(
  cards: readonly DeckBuilderCardView[],
): readonly DeckBuilderCardView[] {
  return Object.freeze(cards.filter(isDeckBuildableCard));
}
