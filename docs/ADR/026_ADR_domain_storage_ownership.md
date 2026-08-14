# ADR-026: Domain Storage Ownership

> Status: accepted
> Decided: 2026-08-14
> Owners: deck-domain, story-domain, application-shell architecture
> Plan: [`../../ai_artefacts/PLAN_2026_08_14_three_ui_restructure.md`](../../ai_artefacts/PLAN_2026_08_14_three_ui_restructure.md) — T5, T12, T13

## Context

Three domains persist different things. Today: duel snapshots use IndexedDB `ygo-story-duel`; decks use IndexedDB `ygo-story-duel-deck-builder-prototype`; the visual novel uses a single `localStorage` blob; UI settings use `localStorage` key `ygo.ui.v2`. Prototype names shipped into a production merge, and the story save model cannot express the durable pre-duel checkpoint the handoff needs.

Three parallel worktrees editing one shared schema would conflict constantly.

## Decision

1. **One durable store per owner. No shared schema.**

| Store | Owner | Kind | Name |
| --- | --- | --- | --- |
| Duel snapshots, debug runs | battle | IndexedDB | `ygo-story-duel` |
| Deck records, edit history, last-opened | deck editor | IndexedDB | `ygo-story-decks` |
| Campaign saves, autosave, pre-duel checkpoint | story | IndexedDB | `ygo-story-saves` |
| Shell + display preferences | shell | localStorage | `ygo.ui.v3` |

2. `localStorage` holds only small, disposable preferences. Everything durable is IndexedDB.
3. Deck migration is **copy → verify → delete**: copy every record and the last-opened pointer into `ygo-story-decks`, re-read and compare `(deckId, revision)` pairs, and only then delete the legacy database. Any mismatch keeps both databases and raises a typed, retryable `DeckMigrationError`. Migration is idempotent.
4. Story saves start fresh: prototype `localStorage` progress is **not** migrated. Slots are `manual:1..3`, `autosave`, `checkpoint:pre-duel`.
5. Every save is a versioned envelope with `schemaVersion`, `revision`, `savedAt`. Reads validate exact keys; unknown versions and corrupt payloads return typed results, never throw raw.
6. Writes to one slot are serialized; a stale `expectedRevision` is rejected rather than overwriting newer data.
7. Quota, corruption and unavailability are typed outcomes surfaced in the UI.
8. No cross-database transaction is assumed. Cross-domain flows use a durable correlation id and recoverable steps (ADR-027).
9. Shell settings migrate `ygo.ui.v2` → `ygo.ui.v3` forward, keeping display settings and adding shell flags.
10. The hidden admin console exposes one reset action per store, each behind a confirmation.

## Alternatives rejected

- **One database for the whole app.** Every domain edit touches one schema; three worktrees would collide on every migration.
- **Move and delete the legacy deck DB in one step.** A failed delete leaves ambiguity about which database is authoritative.
- **Version-bump the prototype-named database in place.** Cheapest, but ships the word `prototype` into production forever.
- **Migrate prototype story progress.** Its shape predates the save model; carrying it forward adds a migration path for disposable data.
- **Keep story progress in `localStorage`.** Cannot express a verified pre-duel checkpoint, and quota failures are silent.

## Consequences

- A worktree changing its own storage cannot break another domain's data.
- Deck data survives the rename; a failed migration is visible and retryable rather than destructive.
- Story gains the checkpoint slot the duel handoff depends on.
- Recovery paths must exist in code, since no multi-store transaction is available.
- Adding a store means adding an admin reset target and an ADR row.
