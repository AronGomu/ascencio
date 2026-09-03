# ADR-040: Deck Library Row — Identity, Order, No Actions

> Status: accepted; planned
> Decided: 2026-08-20
> Owners: decks UI architecture
> Relates: ADR-038 (default deck preference), ADR-023 (hash routes)
> Amended by [ADR-069](069_ADR_default_is_the_only_deck_mark.md): §3 favourite storage and §4 favourite rank are removed.
> Feedback: [`../../feedback-decks.md`](../../feedback-decks.md) — Decks Menu 1, 2, 3, 4

## Context

The library row carried five action buttons (rename, set default, duplicate, export, delete) plus the open button, and the toolbar spread search, sort, import and create over two rows. Feedback round 2 asks for the opposite split: the library is a list you scan and pick from, and everything you do *to* a deck happens on that deck's page (`#/decks/{id}`). It also asks for a favourite star and an order that puts the decks a player reaches for at the top.

Rename already exists twice — a library dialog and the editor's name input. Two rename paths mean two places to keep a name-length rule.

## Decision

1. **One toolbar row.** `deck-library-tools` holds search, sort, `Import Deck`, `Create deck` in that order. The `<header>` keeps only the visually hidden `<h1>`.
2. **Row = identity.** Name and `Default` badge share one line, badge right-justified; counts and "updated" sit below; a star button ends the row. No other control.
3. **Favourites** live in the existing `preferences` store under key `favourite-decks` as a `DeckId[]`. No schema bump (`DECK_DATABASE_VERSION` stays 2). Pruned on read against the `decks` store, exactly like `default-deck`.
4. **Order** is computed by one pure function, `orderDeckLibrary`: rank 0 = default deck, rank 1 = favourite, rank 2 = the rest; ties broken by the selected sort (`modified` → `updatedAt` descending, `name` → `localeCompare`). The default deck outranks its own favourite flag, so "default is always first" holds without a special case at the call site.
5. **Deck actions move to the deck page.** `Duplicate`, `Export`, `Set default`, `Delete` join the editor's top row; delete confirms in a dialog and then routes to `#/decks`. Rename is the existing `deck-name-input` — the library's rename dialog is deleted rather than duplicated.

## Consequences

- The library cannot destroy a deck. Deleting takes two navigations, which is the point: the confirm dialog now names a deck the player is looking at.
- `DeckRepository` grows `listFavourites` / `setFavourite`; every test double implements them.
- Ordering is unit-testable without a DOM, which is what makes "default first, then favourites" a claim the suite can hold.

## Alternatives rejected

- Star stored in the deck record: a favourite is a per-player preference, not deck data; writing it would bump `revision` and fight the optimistic-concurrency check on every star.
- Favourites as a separate object store: one small array in `preferences`, capped by the number of decks, does not need its own store or migration.
- Keeping row actions behind an overflow menu: still two homes for the same five actions, and the feedback names the deck page explicitly.
</content>
