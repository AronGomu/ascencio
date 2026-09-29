# ADR-097: Preserve user bytes, not content/save compatibility

> Status: accepted; implemented
> Implementation consolidated by [ADR-099](099_ADR_completed_manual_sqlite_cutover.md). Baseline statements below remain decision-time history.
> Decided: 2026-09-24
> Owners: user persistence / story / decks / shell
> Amends: ADR-026 §§1–4,9–10 (new user persistence); ADR-076 D3–D5; ADR-088 D1–D5; ADR-091 D2–D3 (save migration/continuity only); ADR-093 D1–D5
> Relates: ADR-049 (Story-owned decks), ADR-050 (ownership), ADR-095 (independent package registry)
> Baseline: `3dbc1ce937ad83865a08622ef1b7070117539718` — live activation couples content selector with forward-prepared Story save generations.

## Context

C1. Existing activation accepts `StoryMigrationPort`, verifies/prepares saves, then selects matching content/save pair. Existing `parseGenerationEnvelope` requires current StoryRelease revision, chapter and beat count. Evidence: `src/shell/application/application-selector.ts`, `src/story/saves/generation-envelope.ts:34-98` at baseline.

C2. Owner explicitly accepts content updates breaking prior saves, including stuck progression, provided user data remains preserved and New Game remains functional. Continuity scanning, migration and retained historical-game selection no longer serve this product contract.

## Decision

D1. All new mutable decks/history/autosaves/default pointers, shell/battle/story preferences, Story slots/checkpoints/handoff/collection and reader progress reside in `user-data.sqlite`. Domains retain semantic ownership, validators and injected repository APIs; SQLite Worker owns physical transactions. Operational app-update approval/diagnostics may remain separate; no hidden gameplay-user-data store remains.

D2. Package import/update/remove/verify never reads or writes user records. No save-continuity gate, forward migration, content-bound save-generation selector, repair or automatic reset. Old saved references may become invalid; silently stuck old progression is accepted, not repaired by package lifecycle.

D3. New Game constructs fresh state from active required packages without reading prior saved slots. Broken Continue/load cannot disable shell navigation or fresh start. Missing required packages remain legitimate readiness blocker. Normal explicit save/overwrite confirmation remains; content update never overwrites slots to make itself succeed.

D4. Backup export emits standalone `user-data.sqlite`; inspection validates new-format schema/integrity/payload structure without installed-content lookup. Restore replaces all current user records only after explicit destructive-action confirmation and revision check. One user-DB transaction exposes whole old or whole restored records; package registry remains untouched. Structurally valid outdated references survive byte-preserved, not rewritten or dropped. No merge.

D5. Fresh installations only. Legacy browser stores are ignored: no read, migration, fallback, conversion or automatic deletion. Explicit normal user actions can change new data; browser-origin eviction remains outside app-induced preservation guarantee.

## Consequences

C1. Content activation becomes independent of saves and avoids cross-database selector atomicity. User backups preserve history even when current content cannot play it.

C2. Updating content can strand existing campaigns without warning or recovery. This cost is intentional. New Game, not save repair, is required recovery path; starting/saving new progress follows normal explicit replacement semantics.

C3. Unified physical user DB requires repository/preference injection across domains. Rapid preference writes need serialization; stale writes and backup failures must surface. Permission for semantic save breakage is not permission to swallow I/O failures.

## Alternatives rejected

A1. Reject content updates that break saves: contrary to owner scope; adds continuity maintenance.

A2. Migrate/rewrite saves during content activation: violates package/user-data isolation.

A3. Pin/reinstall historical content per save: adds retention/history UI explicitly not requested.

A4. Merge backups: ambiguous slot/deck/preference conflicts; confirmed atomic replacement is simpler.

A5. Delete/migrate legacy browser stores: unnecessary backward compatibility and data-risk surface.
