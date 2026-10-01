# ADR-101: JSON user-data storage

> Status: accepted; supersedes SQLite user-save clauses in ADR-097–100
> Date: 2026-09-30
> Scope: mutable user records and backup/restore; content packages remain unchanged

The owner chose JSON files/localStorage to simplify user persistence. Mutable saves do not require a database or SQL queries.

Native Tauri stores one `user-data.json` in its app-data directory. Browser builds store the same versioned JSON document under localStorage key `ascencio:user-data:v1`. The document contains decks, deck metadata/autosaves, Story records, preferences, and read history. Domain adapters continue using `UserDataStore`.

The shared store validates domain payloads, serializes writes, and preserves record/global revision checks. A batched update commits one complete snapshot. Native writes use a temporary file, flush, and rename; browser writes use one `setItem`. Failed validation, conflicts, and failed writes preserve the previous snapshot. Corrupt saves are reported rather than silently reset.

Backup export produces `user-data.json`. Inspection validates JSON format/version, duplicate record identities, namespaces, and domain payloads without querying content. Restore requires explicit confirmation and an unchanged global revision. It replaces the complete user snapshot and never changes installed packages. An uncertain native restore outcome blocks further writes until reopening.

Existing SQLite saves and legacy browser stores remain untouched and unread. No automatic migration or save-continuity guarantee exists. SQLite content packages/registry remain a separate architectural concern.

Implementation: `src/storage/json/`, `src/storage/native/user-json-backend.ts`, and `src-tauri/src/native_user_data.rs`. Former SQL user-runtime code is retained only under `tests/fixtures/legacy-user-*` for historical regression fixtures; it is absent from application imports.
