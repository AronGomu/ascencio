import type { DeckZone } from "../../decks/deck-contracts.ts";
import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
import {
  quantityLimit,
  type PinnedDeckRuleset,
} from "../../decks/catalog/pinned-ruleset.ts";

/** How many cards each zone already holds; a tap target for a full zone is
    offered but disabled, so the menu never changes shape under the finger. */
export interface DeckCounts {
  readonly main: number;
  readonly extra: number;
  readonly side: number;
}

/** The same maxima `validateDeckDraft` reports as errors. */
export const ZONE_CAPACITY: Readonly<Record<DeckZone, number>> = Object.freeze({
  main: 60,
  extra: 15,
  side: 15,
});

const ZONE_LABEL: Readonly<Record<DeckZone | "remove", string>> = Object.freeze(
  {
    main: "Main Deck",
    extra: "Extra Deck",
    side: "Side Deck",
    remove: "Remove from deck",
  },
);

export interface TapTarget {
  readonly zone: DeckZone | "remove";
  readonly label: string;
  readonly enabled: boolean;
  readonly reason: string | null;
}

/** Tapping a catalog card is the touch spelling of dropping it in the only
    zone it may legally enter. */
export function catalogTapZone(card: DeckBuilderCardView): DeckZone {
  return card.canonicalZone;
}

/** The move rules `applyDeckCommand` enforces, spelled as menu items: a card
    leaves the Main or Extra Deck only for the Side Deck, and comes back from
    the Side Deck only to its canonical zone. Removal is always available. */
export function deckTapTargets(
  card: DeckBuilderCardView,
  currentZone: DeckZone,
  counts: DeckCounts,
  ruleset: PinnedDeckRuleset,
): readonly TapTarget[] {
  const forbidden = quantityLimit(ruleset, card.code) === 0;
  const zones = (["main", "extra", "side"] as const)
    .filter((zone) => zone !== currentZone)
    .map((zone) => target(card, currentZone, zone, counts, forbidden));
  return Object.freeze([
    ...zones,
    Object.freeze({
      zone: "remove" as const,
      label: ZONE_LABEL.remove,
      enabled: true,
      reason: null,
    }),
  ]);
}

function target(
  card: DeckBuilderCardView,
  from: DeckZone,
  to: DeckZone,
  counts: DeckCounts,
  forbidden: boolean,
): TapTarget {
  const reason = moveReason(card, from, to, counts, forbidden);
  return Object.freeze({
    zone: to,
    label: ZONE_LABEL[to],
    enabled: reason === null,
    reason,
  });
}

function moveReason(
  card: DeckBuilderCardView,
  from: DeckZone,
  to: DeckZone,
  counts: DeckCounts,
  forbidden: boolean,
): string | null {
  if (forbidden) return "Card is forbidden and can only be removed.";
  const legal = from === "side" ? to === card.canonicalZone : to === "side";
  if (!legal) return "Card cannot move to that zone.";
  if (counts[to] >= ZONE_CAPACITY[to])
    return `${ZONE_LABEL[to]} is full at ${ZONE_CAPACITY[to]} cards.`;
  return null;
}
