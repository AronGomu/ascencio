# ADR-050: Card ownership invariant

Status: accepted · 2026-08-20 · Shipped: `1d3e3a7` (T22), `f03ad13` (T24), `178b64f` (T25), `ca57340` (T26), `9ed8390` (T27) · Plan commit: `9d8b8a7`
Relates: ADR-033 (collection in `StoryState`), ADR-049 (save-owned decks)

## Context

The shop sells packs and buys cards back, and a save now owns its decks (ADR-049). Product direction: in a story you build only from cards that playthrough owns; in free play every card is available at maximum copies.

That turns the collection from a display into a **resource decks depend on**, and creates an invariant:

> every card in a story deck is a card that save owns

Invariants need one definition and one enforcement story, or they rot into four slightly different checks in four screens.

"Free play owns everything" also needs a representation. Materialising a record of every printed card times three copies means writing, migrating and re-materialising a five-figure map every time the card pool grows — for a mode whose whole point is that the answer is always yes.

## Decision

One contract, two implementations:

```ts
interface CardOwnership {
  ownedCount(code: number): number;
  readonly isUnlimited: boolean;
}
```

- `storyCardOwnership(state)` reads `collection[code] ?? 0`.
- `unlimitedCardOwnership()` answers `Infinity` with `isUnlimited: true`. Free play is a **flag**, never a stored record.
- Every consumer reads this one function: the catalog (which cards are offered), the add path (how many copies are addable), deck validation (a new `not-owned` error code), the sell screen (which decks a sale would break), and the pre-battle gate.
- Ownership governs **availability only**. The pinned ruleset's per-card copy limit still governs legality, so addable copies are `min(ownedCount, rulesetLimit)`.
- Selling stays unrestricted. A sale that would break decks names them in a dialog before it commits; confirming sells and leaves those decks illegal.
- An illegal deck cannot start an encounter: pre-battle disables it, explains why, and links to the editor.

## Consequences

- One place to change if ownership rules ever change; four screens that cannot disagree.
- The story catalog is genuinely smaller — it shows what you own, so a card you cannot use never appears in the builder. Window-shopping lives on the collection screen's show-all checkbox instead, which is the screen for it.
- Free play costs nothing to store and never needs migrating when the catalog grows.
- Selling a staple is allowed and its consequence is stated in advance rather than discovered at an encounter.
- A deck can be legal at save time and illegal later. That is the point of the `not-owned` error code, and why validation takes an ownership snapshot rather than trusting a stored summary.
- A deck the save is *handed* has to satisfy the invariant too, and two repairs made it. `c5a27ee` stopped the deck editor seeding its starter deck into a story save: seeding grants a deck and no cards, so the save's only deck was one this build badged `not-owned` and refused at pre-battle. `acbb212` moved that grant to save migration, deck and cards together, and `66967fc` made the collection merge take the higher of the stored and granted count per code, so a pre-v3 save arrives with the starter deck and full playsets behind it — half a playset is as illegal as no deck — while re-reading the same record changes nothing and no owned count is ever lowered.
