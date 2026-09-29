# ADR-095: Manual immutable SQLite package delivery

> Status: accepted; implemented
> Implementation consolidated by [ADR-099](099_ADR_completed_manual_sqlite_cutover.md). Baseline statements below remain decision-time history.
> Decided: 2026-09-24
> Owners: content / storage / asset tooling
> Amends: ADR-075 D1–D4; ADR-080 D1–D2,D4; ADR-082 D1–D6; ADR-083 D1,D3–D5; ADR-085 D1–D5; ADR-092 D1–D4; ADR-094 D1–D2,D4–D5 (content transport/storage only)
> Relates: ADR-096 (package ownership), ADR-097 (user-data isolation), ADR-098 (SQLite Worker ownership)
> Baseline: `3dbc1ce937ad83865a08622ef1b7070117539718` — live Shell uses progressive Cache/IndexedDB delivery; this decision is not implementation evidence.

## Context

C1. Live bootstrap calls `openProgressiveContentStore`; legacy ZIP installer remains exported too. Replacing only legacy installer leaves current hosted delivery intact. Evidence: `src/shell/application/application-bootstrap.ts:1-24`, `src/content/index.ts` at baseline.

C2. Browser-to-host downloads require publication/pointer/CORS/credential tooling. Product instead accepts external manual download plus file selection, avoiding game backend and managed object-store delivery. Large card libraries make thousands of browser file/record writes undesirable.

## Decision

D1. Developer CLI exports immutable versioned SQLite package files. User downloads through external host in browser, then selects `.sqlite` files in app. App never fetches external package URLs. Hosted R2/S3 publication, progressive per-file/player ZIP paths and developer hosted bundle transport retire. Upstream source acquisition remains separate and retained. No remote resource deletion follows from code retirement.

D2. Each package has one typed manifest row, versioned schema, explicit dependency requirements, package-owned tables/BLOBs. Selected batch validates structure, integrity, predecessor closure and retained dependants before activation. Missing required data rejects; optional media may be absent and yields placeholders/warnings. Signatures remain outside scope; checksums detect corruption, not publisher authenticity.

D3. Immutable package DBs reside in OPFS, read-only through SQLite Worker. `content-registry.sqlite` alone selects active package stack. All selected files stage under private unique names before one registry generation-CAS transaction exposes complete candidate stack. Failed precommit import preserves old stack. Atomic promotion means registry visibility, not physical multi-file rename or cross-DB atomicity.

D4. Startup checks registry/schema/dependency/file presence, not whole-library hashes. Full verification occurs at import or explicit Verify action. Requested media loads on demand; bounded hot cache and URL leases preserve optional-media behavior. No Cache Storage/per-asset IndexedDB content store remains. SQLite executable belongs app cache; game package bytes do not.

D5. Updates are explicit imports at Main Menu, with no active gameplay session. Removal rejects installed dependants, never consults saved refs, never mutates user data. Logical removal commits before byte cleanup; cleanup failure is reported as pending cleanup, not fictitious rollback. Unused-file cleanup is explicit; active registry-referenced files are never removed based on staging suffix alone.

## Consequences

C1. Manual package transfer removes managed host transport but adds user download/file-selection steps. Updating large card library requires transferring large SQLite file; per-file bandwidth reuse is deliberately lost.

C2. Staging and retained previous files consume extra quota. OPFS eviction remains possible. Successful Node unit tests do not prove browser durability; owner manual Chromium acceptance remains required.

C3. External links can expire. Null/unavailable link does not block local file import. Public redistribution still requires rights evidence and explicit owner action. App service-worker update consent remains separate, per ADR-094 D3.

## Alternatives rejected

A1. Progressive remote per-file delivery: hosting/publisher/CORS lifecycle exceeds manual pipeline needs.

A2. ZIP extraction into browser files/records: too many writes and archive-specific staging.

A3. In-place SQLite replacement: crash can expose incomplete content; immutable files plus registry transaction separate preparation from visibility.

A4. Direct file-system folder scan: PWA cannot treat arbitrary externally downloaded folder as reliable origin-owned storage.
