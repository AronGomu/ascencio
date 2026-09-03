# ADR-037: Manual Deck Order with Position-Blind History

> Status: accepted; planned
> Decided: 2026-08-16
> Owners: decks data architecture
> Amended by [ADR-044](044_ADR_autosave_records_every_command.md): `reorder`/`sort` now **do** append to the autosave log; the "append nothing" clause in §3 is superseded.
> Amended by [ADR-070](070_ADR_explicit_sorts_are_undoable.md): §3 remains position-blind for `reorder`, but explicit `sort` now appends one undo-history entry.

## Context

The editor auto-sorted every mutation (`sortDeckCards` after each accepted command). Feedback 15 demands manual ordering: cards stay where the player puts them, drag swaps/moves within a zone, sorting happens only on explicit buttons. Feedback 19 adds the constraint that the autosave/action log must **not** record positions within a section. History (`DeckHistory`) and the stored-history consistency validator both compared card lists in exact order, so an unrecorded reorder would make a stored deck look corrupt.

## Decision

1. `applyDeckCommand` stops sorting. `add` and `move` append at the end of the target zone; `import`/`restore` keep the given order.
2. New commands: `reorder` (same-zone; occupied target index → swap, past-the-end → move to end), `sort` (`alpha` | `type`; `type` = monsters, spells, traps, then name — extra deck by Fusion/Synchro/Xyz/Link), `restore` (autosave re-application; like import but never flags `importedNeedsReview`), and `add` accepts an optional explicit `zone` (canonical or side).
3. History is **membership-only**. `pushDeckUpdate` and the repository's stored-history consistency check compare zone lists as *multisets* (sorted canonical form). `reorder`/`sort` push no history entry, are not undoable, and append nothing to the autosave log. Undo/redo therefore revert what cards are in the deck, never where they sit.
4. Zone capacity is not model-enforced for `add` (only copy limit / forbidden / zone legality); overflow routing (main full → side) is a UI decision at the call site.

## Alternatives rejected

- Record reorders as history entries but filter them from the autosave list: undo stack fills with position noise; feedback's "do not record position" reads as one rule, not two.
- Keep exact-order history and synthesize entries for reorders: contradicts the same rule and bloats the 50-entry cap with non-edits.
- Persist card positions as a separate layout table: order already lives in the stored lists; a second source of truth invites drift.
