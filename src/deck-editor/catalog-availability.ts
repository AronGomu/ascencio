/* What an editing context is allowed to offer and to accept, in one place.

   Two limits meet here and neither replaces the other: what the player owns and
   how many copies the pinned ruleset lets a deck run (ADR-050). The addable
   count is the smaller of the two, so owning nine copies never legalises nine
   and free play owning every card never raises the per-card limit either.

   Free play falls out of the arithmetic rather than out of a branch:
   `ownedCount` answers `Number.POSITIVE_INFINITY` for every code, so the
   minimum is always the ruleset's. `isUnlimited` is read only where skipping
   the work is worth something — the catalog filter below, which is a pass over
   14,794 cards for an answer that is always yes. */

import type { CardOwnership } from "../decks/card-ownership.ts";
import type { DeckBuilderCardView } from "../decks/catalog/ocg-card-mapper.ts";

/** How many further copies of `code` may be added, given the copies a deck
    already holds across every zone. Zero means the add affordance is spent. */
export function availableCopies(
  code: number,
  ownership: CardOwnership,
  rulesetLimit: number,
  usedCopies: number,
): number {
  return Math.max(
    0,
    Math.min(ownership.ownedCount(code), rulesetLimit) - usedCopies,
  );
}

/** Why no further copy may be added, named after whichever limit is binding.

    Ownership answers only when it is strictly the smaller of the two, so free
    play — and a story save that owns more copies than a deck may run — keeps
    the wording `applyDeckCommand` already rejects with. */
export function unavailableReason(
  ownedCount: number,
  rulesetLimit: number,
): string {
  if (rulesetLimit === 0) return "Card is forbidden.";
  if (ownedCount < rulesetLimit) return `You own ${ownedCount} of this card.`;
  return `Copy limit ${rulesetLimit} reached.`;
}

/** The cards a context may build from: its own, or all of them in free play. */
export function ownedCatalog(
  cards: readonly DeckBuilderCardView[],
  ownership: CardOwnership,
): readonly DeckBuilderCardView[] {
  if (ownership.isUnlimited) return cards;
  return Object.freeze(
    cards.filter(({ code }) => ownership.ownedCount(code) > 0),
  );
}
