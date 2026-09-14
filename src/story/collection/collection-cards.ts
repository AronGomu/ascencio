/* What the collection screen browses: the card database, plus a rarity for
   every code in it.

   Rarity is not stored. A save's collection is counts only — code to copies —
   so the tier a card is shown at has to be resolved from the shop's set data,
   and inferred from the card itself for a code no set sells (ADR-050 keeps the
   collection to counts; `shop-set-data.ts` owns the resolution rule).

   Resolved once into an index rather than per card. `resolveCardRarity` scans
   every set on every call, and the two inputs here are 4,654 printed cards
   across 50 sets and a catalog of 14,794: asking it per code is ~68.8 million
   comparisons for one screen open. One pass over the sets and one lookup per
   card is the same answer at 19,448 steps. */

import type { Cards } from "../../cards/index.ts";
import type { StorySet } from "../ports/story-release.ts";
import { cardsDeckCatalog } from "../../decks/catalog/index.ts";
import type { DeckBuilderCardView } from "../../decks/catalog/index.ts";
import type { ShopRarity } from "../model/story-state.ts";
import { inferRarity } from "../shop/data/shop-rarity.ts";
import {
  installedShopSetData,
  type ShopSetData,
} from "../shop/data/shop-set-data.ts";
import { RARITY_ORDER } from "./group-by-rarity.ts";

export interface CollectionCatalog {
  readonly cards: readonly DeckBuilderCardView[];
  readonly rarityByCode: ReadonlyMap<number, ShopRarity>;
}

/** The rarity every card in `cards` is shown at.

    A card printed in several sets is shown at the highest tier it was ever
    printed at, which is the rule `resolveCardRarity` already applies one code
    at a time. `data` is `null` when the shop set file could not be read: every
    rarity is then inferred from the card, which is a worse answer than the
    printed one but still an ordered one, so the screen groups rather than
    collapsing the whole database into a single "common" heading. */
export function collectionRarityIndex(
  cards: readonly DeckBuilderCardView[],
  data: ShopSetData | null,
): ReadonlyMap<number, ShopRarity> {
  const printed = new Map<number, ShopRarity>();
  for (const set of data?.sets ?? []) {
    for (const card of set.cards) {
      const best = printed.get(card.code);
      if (best === undefined || rank(card.rarity) > rank(best))
        printed.set(card.code, card.rarity);
    }
  }
  const index = new Map<number, ShopRarity>();
  for (const card of cards)
    index.set(card.code, printed.get(card.code) ?? inferRarity(card));
  return index;
}

/**
 * Reads both halves of what the collection screen renders.
 *
 * Card records plus set printings come from one verified installed gameplay
 * union, matching editor, duel, shop, and preview without another fetch.
 * Cards absent set printings retain inferred rarity; no external shop source
 * or whole-catalog fallback participates.
 */
export async function loadCollectionCatalog(
  definitions: Cards,
  sets: readonly StorySet[],
): Promise<CollectionCatalog> {
  const cards = cardsDeckCatalog(definitions);
  const data = installedShopSetData(sets);
  return Object.freeze({
    cards,
    rarityByCode: collectionRarityIndex(cards, data),
  });
}

function rank(rarity: ShopRarity): number {
  return RARITY_ORDER.indexOf(rarity);
}
