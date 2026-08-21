/** How many copies of a card the context being edited may draw on.

    Two questions live next to each other here and must not merge: this one
    answers what the player *has*, the pinned ruleset answers how many of it a
    deck may *run*, and an addable count is `min(ownedCount(code),
    quantityLimit(ruleset, code))` (ADR-050). Owning nine copies never makes a
    deck of nine legal, and free play owning every card never raises the
    per-card deck limit either — a card pinned to zero stays unaddable in both
    worlds.

    Reading is synchronous, total and pure: no fetch, no storage, no state
    change. Every consumer — the catalog, the add path, deck validation, the
    sell screen and the pre-battle gate — reads this one contract, so ownership
    cannot come to mean two different things in two screens.

    It lives in the shared deck library rather than in the visual novel because
    the deck editor is one of those consumers. The editor's only legal path
    into `src/story/**` is `src/story/index.ts`, which also exports the visual
    novel itself, so importing ownership from there takes the deck-editor
    closure from 106,171 to 210,228 bytes against the 143,750-byte budget in
    `scripts/lib/domain-chunk-closure.ts` — the same trap
    `deck-repository-context.ts` documents. `src/decks/` is open to every
    domain, so the free-play half below costs any caller nothing. The story
    half needs `StoryState` and cannot come back the other way, so it stays in
    `src/story/decks/card-ownership.ts`. */
export interface CardOwnership {
  /** Copies of `code` this context owns; zero for a card it does not own.
      Never negative — a save carrying a negative count is rejected by the save
      reader before it reaches here. */
  ownedCount(code: number): number;
  /** True when this context owns every printed card without limit. Says
      nothing about how many copies a deck may run: that is the ruleset's
      answer, and it still applies. */
  readonly isUnlimited: boolean;
}

/* One instance, because free play holds no state: a view may memoise on it,
   and two callers comparing their ownership get the same answer. */
const UNLIMITED: CardOwnership = Object.freeze({
  ownedCount: () => Number.POSITIVE_INFINITY,
  isUnlimited: true,
});

/** Free play, where every printed card is available at maximum copies.

    A flag rather than a materialised record. The pool is 14,794 cards, so
    owning them all would mean writing, migrating and re-materialising a
    five-figure map on every player's disk, and re-materialising it again every
    time the pool grows — for a mode whose answer is always yes. */
export function unlimitedCardOwnership(): CardOwnership {
  return UNLIMITED;
}
