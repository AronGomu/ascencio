# ADR-093: One selector exposes content with forward-migrated saves

> Status: accepted; planned
> Decided: 2026-09-13
> Owners: shell application / story persistence / content receipts
> Amends: ADR-085 D3; ADR-088 D1–D5; ADR-076 D3–D5; ADR-026 §8 clarified
> Baseline: `010401956d0cd59d8e6dda91bd367040f5de669e` — inspected integration source, not implementation evidence for this decision.

## Context

Content active-pointer writes and Story slot writes use separate IndexedDB databases. Web Locks serialize clients but cannot roll back an already committed foreign DB. Installed updates must preserve current saves on failure, without historical game-version UI. Source at baseline 010401956d: src/content/storage/content-database.ts; src/story/saves/story-save-repository.ts.

## Decision

D1. Story owns generation-scoped save records and pure forward migration. Every supported manual/autosave/checkpoint slot is copied into a new generation; original generation stays byte-identical. Unknown legacy schema remains preserved/incompatible, never assigned guessed release identity.

D2. Shell owns one durable application selector containing Content receipt/ref plus Story generation token. Content receipts describe staged verified bytes only; no independent Content active pointer or Story active pointer determines visibility. Story receives generation-scoped repository/semantic revision, not Content refs.

D3. Required files verify before exclusive activation. Under application lifecycle lock, Story prepares and seals all migrated slots; preparation completes before one Shell IDB generation-CAS selects matching content/save pair. No Cache/network/hash/foreign DB work occurs inside selector transaction.

D4. Crash before selector commit leaves old pair; crash after commit exposes already-prepared new pair. Quota/conflict/migration failure preserves previous visible saves/content. Prepared orphan generations are not automatically deleted. Ordinary browser storage loss after commit is detected by Shell and contained, not silently paired with different saves.

D5. Official release continuity is forward-only. Stable beat/card/set/location/deck references survive or migration refuses activation. No rollback selector. Main Menu-only exclusive activation refuses immediately while any cooperating domain tab holds shared session lease; BroadcastChannel is notification, never locking authority.

## Consequences

C1. Logical atomic visibility preserves domain DB ownership and avoids compensating save overwrites.

C2. Temporary save duplication and selector DB add storage/coordination cost. This is not physical atomicity across databases or immunity to browser eviction. Every save/admin/handoff path must respect injected generation and lifecycle lock.

## Alternatives rejected

A1. Sequential in-place migration then pointer update: crash loses prior save state.

A2. Two independent active pointers plus shared lock: durable mismatch after crash.

A3. Merged domain DB: unnecessary ownership coupling; Cache still cannot join its transaction.

A4. Pinned historical-game selector: conflicts with forward-only product direction.
