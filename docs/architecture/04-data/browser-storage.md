# Browser Storage

> Status: implemented
> Decision: [ADR-099](../../ADR/099_ADR_completed_manual_sqlite_cutover.md)

## SQLite/OPFS authority

Dedicated `src/storage/sqlite-worker.ts` owns OPFS SQLite runtime for one active tab under Web Lock `ascencio-sqlite-owner-v1`.

- S1. Immutable package DBs open read-only. `content-registry.sqlite` records active package mappings/generation/import receipts.
- S2. `user-data.sqlite` stores mutable decks, deck metadata/autosaves, Story records, preferences, and Story read log.
- S3. Package registry and user DB are isolated. Package lifecycle never scans, migrates, repairs, or rewrites saves.
- S4. Legacy browser stores remain untouched and unread. No startup migration or deletion exists.
- S5. Backup export/inspect/confirmed restore affects user DB only; installed packages remain unchanged.

## IndexedDB retained operational scope

`idb` remains for explicit service-worker app-update approval and bounded Battle diagnostics. Those records are operational state, not imported-content authority or hidden gameplay user-data. They are excluded from `user-data.sqlite` backups.

## Cache Storage retained app scope

Service Worker Cache Storage owns versioned app-shell/precache bytes, including exact emitted SQLite executable WASM. It does not own game-content packages, card/chapter media, OCG WASM, or package activation.

## Reliability rules

- R1. Worker serializes mutations; active domain sessions block package mutation/restore where required.
- R2. Package activation changes only after complete selected batch validates and registry generation compare-and-swap commits.
- R3. Precommit failure/cancel/quota preserves prior stack; cleanup never deletes active mapped files.
- R4. User-data writes use revisions; backup restore requires validated preview, explicit confirmation, and unchanged current revision.
- R5. Storage/browser durability, quota, crash recovery, and second-tab ownership remain owner-run Chromium acceptance gates.
