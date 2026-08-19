# ADR-038: Deck Database v2 — Autosave Log and Default Deck

> Status: accepted; planned
> Decided: 2026-08-16
> Owners: decks storage architecture
> Relates: ADR-026 (domain storage ownership)
> Plan: [`../../ai-artifact/PLAN_2026_08_16_decks_feedback.md`](../../ai-artifact/PLAN_2026_08_16_decks_feedback.md) — T12, T13, T14

## Context

Feedback 19 wants a load dialog backed by "the last hundred actions" with timestamp + deck name per entry. General-1 wants an assignable default deck, a seeded starting deck in storage, and the duel menu auto-selecting it. `ygo-story-decks` is at version 1 (`decks`/`histories`/`preferences`); the legacy prototype migration opens databases by the shared version constant — a naive bump would fire `upgradeneeded` on the player's legacy database and delete it via the created-husk cleanup path.

## Decision

1. `DECK_DATABASE_VERSION = 2`. New object store `autosaves` (`keyPath: "id"`, index `createdAt`). `createDeckStores` becomes upgrade-aware (`objectStoreNames.contains` guards) so v1 → v2 keeps data.
2. The legacy prototype database is opened with a **pinned** `LEGACY_DECK_DATABASE_VERSION = 1`, permanently. Migration still copies only the three legacy stores.
3. Autosave log: global across decks, capped at 100 entries (oldest evicted), one entry per membership-changing edit (add/remove/move/import/restore/undo/redo), each `{ id, deckId, deckName, createdAt, main, extra, side }`. Position-only changes append nothing (ADR-037). Appends are best-effort — a failed log write never fails the save.
4. Restoring an entry replays its card lists through the `restore` command into its deck (recreating the deck under the logged name when deleted); the restore itself is a normal undoable edit.
5. Default deck: `preferences` row `default-deck` (no schema bump needed for it). Cleared automatically when its deck is deleted. A fresh install is seeded once with a "Starter Deck" built from the bundled `player.ydk` and marked default; seeding is idempotent and adopt-first (an existing deck of that name becomes default rather than duplicated).

## Alternatives rejected

- Per-deck autosave lists inside `histories`: feedback describes one chronological list across editing sessions; the 50-entry undo cap and validation live there and should not double as a log.
- Storing autosaves in `localStorage`: card lists × 100 exceed sensible quota; IndexedDB already owns deck data (ADR-026).
- Seeding from the duel picker only: the editor is where decks live; both surfaces call the same idempotent `ensureStarterDeck`, whoever opens first wins.
