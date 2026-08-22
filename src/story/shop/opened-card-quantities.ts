import type { OpenedCard } from "../model/story-state.ts";

/** One pulled card plus how many of it the opening produced. */
export type OpenedCardQuantity<T extends OpenedCard> = T & {
  readonly quantity: number;
};

/**
 * Collapses repeats into one entry carrying a count.
 *
 * Six packs of nine repeat heavily, and a recap that lists the same common
 * nine times is a list nobody reads. The count is the card, said once.
 *
 * Keyed on the code alone rather than on code-and-rarity: the results list
 * addresses a card's badge by code, so a code split across two entries would
 * render two elements under one `data-cy`. Opening all packs can span sets,
 * and a code carried by two sets could in principle carry two tiers — but
 * every one of the 4,654 codes in the shipped `story/shop-sets.v1.json` sits
 * at exactly one rarity across all 50 sets, so no pull can produce the split.
 * If one ever does, the first pull's tier stands for the pile, where
 * `resolveCardRarity` would take the highest; that is the line to change.
 *
 * Order is first pull first, so the ungrouped list reads as the packs came
 * out — the rarity grouping is what re-sorts it, and it does that itself.
 *
 * Pure, and it never touches the array handed in: `groupByRarity` re-reads
 * the counted list on every cycle of the rarity button.
 */
export function groupOpenedCards<T extends OpenedCard>(
  cards: readonly T[],
): readonly OpenedCardQuantity<T>[] {
  const counted = new Map<number, { readonly card: T; quantity: number }>();
  for (const card of cards) {
    const entry = counted.get(card.code);
    if (entry === undefined) counted.set(card.code, { card, quantity: 1 });
    else entry.quantity += 1;
  }
  return Object.freeze(
    [...counted.values()].map(({ card, quantity }) =>
      Object.freeze({ ...card, quantity }),
    ),
  );
}
