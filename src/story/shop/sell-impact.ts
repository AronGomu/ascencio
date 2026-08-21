import { storyCardOwnership } from "../decks/card-ownership.ts";
import type { StoryState } from "../model/story-state.ts";

/** One deck a sale would leave holding cards the save no longer owns, and the
    sold cards that would do it. Named by deck rather than by card because that
    is what the player has to go and fix. */
export interface SaleDeckImpact {
  readonly deckId: string;
  readonly deckName: string;
  readonly codes: readonly number[];
}

/** Which decks this sale would turn illegal, asked before it is dispatched.

    Counterfactual, not post-hoc: ownership is read twice, once off the save as
    it stands and once off the collection as the sale would leave it, and a
    deck is named only for a card that crosses between the two. Validating
    after the fact answers a different question — it would blame this sale for
    a deck that was already over its owned copies, and send the player to
    repair something the sale never touched.

    The same count `validateDeckDraft` takes, so the warning here and the
    `not-owned` badge on the deck library cannot disagree: copies are totalled
    across Main, Extra and Side, because a card sleeved into two zones is still
    two copies of one card the save has to own (ADR-050).

    Selling stays unrestricted — this only informs. A caller that ignores the
    answer sells exactly what it would have sold. */
export function decksBrokenBySale(
  state: StoryState,
  items: readonly { readonly code: number; readonly quantity: number }[],
): readonly SaleDeckImpact[] {
  /* Totalled per code before anything is projected, exactly as the reducer
     totals the receipt: two rows naming one card are one sale of both. */
  const sold = new Map<number, number>();
  for (const { code, quantity } of items)
    if (quantity > 0) sold.set(code, (sold.get(code) ?? 0) + quantity);
  if (sold.size === 0) return [];

  const remaining: Record<number, number> = { ...state.collection };
  for (const [code, quantity] of sold)
    /* Never below zero: the stepper caps at what is owned and the reducer
       refuses a receipt that would go further, and a negative count is a
       collection no reader of this save is allowed to see. */
    remaining[code] = Math.max(0, (remaining[code] ?? 0) - quantity);

  const owned = storyCardOwnership(state);
  /* Built from the hypothetical save rather than the live one: the reader
     binds the collection it is handed, so this is the only way to ask what
     the player would own once the sale went through. */
  const afterSale = storyCardOwnership({ ...state, collection: remaining });

  const impacts: SaleDeckImpact[] = [];
  for (const deck of state.decks) {
    const used = new Map<number, number>();
    for (const code of [...deck.main, ...deck.extra, ...deck.side])
      used.set(code, (used.get(code) ?? 0) + 1);
    const codes = [...sold.keys()].filter((code) => {
      const count = used.get(code) ?? 0;
      return (
        count > afterSale.ownedCount(code) && count <= owned.ownedCount(code)
      );
    });
    if (codes.length > 0)
      impacts.push({ deckId: deck.id, deckName: deck.name, codes });
  }
  return impacts;
}
