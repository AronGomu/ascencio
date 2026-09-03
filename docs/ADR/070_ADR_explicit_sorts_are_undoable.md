# ADR-070: Explicit deck sorts are undoable

> Status: accepted; planned
> Decided: 2026-09-02
> Owners: decks, deck editor
> Amends: ADR-037 §3 (sort is no longer position-blind), ADR-044 §2 (sort now enters `DeckHistory`)

## Context

ADR-037 made both manual reorder and explicit sort position-blind: neither entered `DeckHistory`. ADR-044 later made every accepted command enter the autosave log while explicitly retaining position-blind undo.

The editor now offers seven explicit sort modes plus direction. Choosing one can replace a carefully arranged order across every zone. Unlike drag reorder, this is a named bulk mutation selected from a control. Users require the action to be reversible.

## Decision

1. Explicit `sort` commands append one `DeckHistory` entry and remain autosaved.
2. Manual `reorder` remains position-blind and does not append history.
3. `DeckCommand` sort names mode and direction: `mode` is `alpha | type | level | attribute | race | atk | def`; `direction` is `asc | desc`.
4. Descending reverses the primary key only. Tie-break keys remain ascending and end in card name. Missing metadata sorts last; original index is final stable tie-break.
5. One select change or direction-toggle press creates at most one history entry.

## Consequences

- `Ctrl+Z` can undo a sort but still ignores manual drag reorder. Two ordering actions intentionally have different history semantics.
- A user who alternates sort modes consumes the bounded undo window faster.
- Autosave and undo now both preserve pre-sort order; stored history remains full-list snapshots without schema change.
- Existing comments/tests asserting all positional commands are history-free must narrow to reorder only.

## Alternatives rejected

- Keep sort non-undoable: a bulk order replacement has no recovery despite being an explicit command.
- Make reorder undoable too: fills history with fine pointer movements and reverses ADR-037 without user need.
- Treat sort as view-only: export/autosave order would disagree with the visible editor.
- Reverse every comparator key for descending: equal primary groups become unstable to scan and differ needlessly from ascending tie order.
