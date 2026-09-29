# ADR-098: Single-owner SQLite Worker

> Status: accepted; implemented
> Implementation consolidated by [ADR-099](099_ADR_completed_manual_sqlite_cutover.md). Baseline statements below remain decision-time history.
> Decided: 2026-09-24
> Owners: local storage / shell / build
> Amends: ADR-076 D1,D5; ADR-085 D1–D5 (storage implementation); ADR-091 D1–D4 (storage boundary/mode readiness); ADR-093 D5; ADR-094 D5 (multi-tab coordination only)
> Relates: ADR-095 (package registry), ADR-097 (separate mutable user DB)
> Baseline: `3dbc1ce937ad83865a08622ef1b7070117539718` — app coordinates independent domain tabs through lifecycle/session locks.

## Context

C1. Browser SQLite requires OPFS-aware WASM runtime. Official SQLite SAH-pool VFS supports async chunked `importDb(name, callback)` without COOP/COEP headers, but one browsing context owns pool. Its logical names are not physical OPFS filenames. Evidence: https://sqlite.org/wasm/doc/trunk/persistence.md (2026-09-24).

C2. Owner accepts one active app tab/window. Keeping multi-tab gameplay would add coordination without required product value. Existing OCG Worker remains sole duel-rule authority.

## Decision

D1. One lazy dedicated SQLite Worker owns read-only content DBs, writable registry and writable user-data DB in OPFS SAH pool. App acquires lifetime exclusive Web Lock `ascencio-sqlite-owner-v1` before pool initialization. Another tab receives already-open state, never forced takeover, reset or pool deletion. Pool persists across Worker lifetimes.

D2. `src/storage/` owns focused SQLite driver/contracts/schema/client modules. Public client entry is lazy; pure schema entry serves Node producer/tests. Shell composes semantic Cards/Battle/Story/user-persistence adapters. Screens receive domain-friendly ViewModels/actions; no SQL, DB handles or arbitrary filesystem operations cross UI boundary. Pure domain payload validators remain narrow public entries, never imports of gameplay UI into storage Worker.

D3. RPC is fixed allowlisted methods with runtime-validated args/results, correlated request IDs, progress, cancellation and typed media warnings. Worker errors settle pending requests. Package mutations serialize and reject active domain sessions. Node unit adapters exercise real SQLite transactions; browser OPFS is separate manual acceptance.

D4. SQLite JS/WASM and incremental hash implementation ship as app executable. OCG WASM remains exclusively duel-core package data. App precache permits exact emitted SQLite WASM URL, not all WASM. Existing OCG loader/binary/manifest stay frozen; main thread never initializes or calls OCG.

D5. Metadata queries page requested rows; media reads fetch only requested BLOBs. Existing synchronous OCG callbacks use preloaded script/card maps, never async DB calls. Media URL leases release on mode close. Import hashes/copies chunks rather than buffering whole multi-GB DB. Atomic activation follows registry mapping, not SAH-pool filename rename assumptions.

## Consequences

C1. Static app hosting needs no cross-origin isolation headers solely for SQLite. Worker/tab ownership and failure states stay explicit.

C2. Only one app tab/window can play or manage content at once; suspended owner can block second window until closed. Main Menu mutations remain blocked by active local gameplay session.

C3. SQLite runtime adds app download/cache weight; build budgets must account for this specific executable. SAH-pool capacity, browser quota/eviction and close/crash behavior require manual Chromium evidence. Unit tests do not establish those guarantees.

## Alternatives rejected

A1. One SQLite instance per domain: races/locking complexity across shared OPFS data.

A2. Main-thread SQLite: UI stalls and unavailable sync OPFS facilities.

A3. Reuse duel Worker for storage lifecycle: couples import/backup lifetime to active duel and risks asynchronous core callbacks.

A4. Multi-tab OPFS VFS/shared service: unnecessary concurrency and hosting/coordination surface after explicit single-tab decision.
