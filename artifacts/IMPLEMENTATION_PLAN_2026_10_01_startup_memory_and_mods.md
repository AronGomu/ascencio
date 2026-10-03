# Startup memory and mod content implementation plan

Status: T1–T9 implementation is present and desktop validation is recorded. T10 release acceptance remains open for physical mobile, native audio/video failure cases and external diagnostic handlers. The required pre-implementation T0 baseline/budgets were not captured and cannot be established retroactively. Evidence: [T0 implementation](STARTUP_MEMORY_T0_IMPLEMENTATION.md), [current implementation evidence](STARTUP_MEMORY_IMPLEMENTATION_EVIDENCE.md). Governing decision: [ADR-104](../docs/ADR/104_ADR_startup_memory_content_and_mod_overrides.md). Requirements and rollout intent: [plan](PLAN_2026_10_01_startup_memory_and_mods.md).

## Current seams and required changes

| Current seam                                                                                    | Required change                                                                                                |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/main.ts` awaits native seeding before shell mount                                          | Mount a content-independent startup shell and initialize logging before seeding/verification                   |
| `src/shell/application/application-bootstrap.ts` checks readiness                               | Own the complete startup state machine and only publish a complete ready session                               |
| `src/shell/application/sqlite-application-service.ts` acquires per-mode inputs                  | Bind domains to app-lifetime prepared content; maintain leases without disk queries                            |
| `src/shell/adapters/sqlite-content-inputs.ts` pages through all cards                           | Consume one verified startup snapshot, never page through native IPC on navigation                             |
| `sqlite-freeplay-inputs.ts`, `sqlite-story-inputs.ts`, `sqlite-battle-runtime.ts` query content | Split pure projection from I/O, prepare once; retain engine/script inputs for in-memory Worker startup/restart |
| `src/storage/modules/catalog-queries.ts` caches only composed libraries                         | Replace per-query native routing with a shared single/multi-pack catalog and indexes                           |
| `src/storage/json/user-data-store.ts` rereads on operations                                     | Initialize once, validate mutations against live memory, track dirty/persisted revisions                       |
| `src-tauri/src/native_user_data.rs` rereads inside `write_source`                               | Exclusive process/session writer and cached durable revision; no runtime read-before-write                     |
| `src-tauri/src/native_storage.rs`, `native_package_manager.rs` own SQLite lifecycle             | Add JSON snapshot/compiler/media contracts, migrate lifecycle, then retire runtime SQL paths                   |
| `src/shell/adapters/sqlite-image-source.ts`, `sqlite-story-media.ts` own media leases           | Generalize for live filesystem media, revision-aware leases and nonfatal failures                              |
| `scripts/lib/sqlite-content/`, `content/packages.json`, native release scripts                  | Add readable source export, deterministic compiler, media extraction and revised staging/verification          |

Names for new focused files below are suggestions, not existing APIs. Keep pure contracts in appropriate storage/module/public entries. Public API changes update the frozen boundary tests intentionally. Preserve narrow ownership; do not deep-import Story or Battle internals into storage or shell.

## Dependency order

```text
T0 evidence/contracts → T1 diagnostics foundation
T0 → T2 readable schemas/compiler → T3 native startup snapshots
T1 + T3 → T4 app memory + T5 user-state writer
T2 + T3 + T4 → T6 mods and overrides
T2 + T3 → T7 live media
T1 + T4 + T5 + T6 + T7 → T8 complete startup/recovery lifecycle
T8 → T9 production cutover → T10 release acceptance
```

## T0 Establish evidence and executable contracts

Requirements: R1, R2, R10, R12.

- [ ] T0.1. Record current actual Tauri release-build launch, Freeplay, New Game, Continue, deck editor, first duel, and return/reentry timing. Separate command latency, SQL/read cost, serialization, frontend projection, engine preparation, and media decode.
- [x] T0.2. Instrument native file opens/reads and frontend storage commands by category and startup/session ID. Use disposable app-data; never benchmark by editing real saves.
- [x] T0.3. Freeze startup lifecycle and I/O categories in pure contracts. Define `READY` precisely; asset access is distinct from gameplay/config reads. Keep OS/browser module loading out of the logical data counter while warming common UI modules.
- [ ] T0.4. Record reference desktop and physical mobile hardware, release/debug distinction, cold/warm conditions, data/mod sizes and resident/peak memory. Establish explicit startup/memory budgets in the ticket evidence before implementation; retain the plan's proposed navigation/search targets or explain a measured adjustment.

Exit: reproducible end-to-end baseline and an I/O assertion that fails on existing domain/session/user rereads. Do not use the Node metadata benchmark as native acceptance.

## T1 Initialize durable diagnostics before content

Requirements: R9.

- [x] T1.1. Add native session logger and structured diagnostic contracts, with stable codes, source location, phase, expected/received, related notes, cause chain and remediation.
- [x] T1.2. Resolve the native log directory at the start of app setup. Support bounded JSONL and readable rendering, rotation without reading game data, and logging failure fallback.
- [x] T1.3. Expose only scoped open-log/open-log-directory operations, copy details/path, and mobile in-app/export/share fallback. Do not allow arbitrary mod-supplied opener targets.
- [x] T1.4. Add a minimal bundled startup/error Svelte surface reachable before `seedNativeContent`; remove reliance on game content for displaying errors. Preserve a last-resort message if the webview itself cannot initialize.

Exit: simulated seeding failure, unreadable data, malformed JSON and log-directory denial show useful diagnostics before the main menu. Open-log action opens the exact written file; an unavailable external handler is reported honestly.

## T2 Define readable sources and deterministic snapshots

Requirements: R2, R3, R5, R10, R11.

- [x] T2.1. Define versioned manifests and focused JSON schemas for cards, sets/printings, decks, opponents, rules, chapters and stable event/choice chains. Use readable named fields; preserve all existing engine fields and localization strings losslessly.
- [x] T2.2. Define per-card folder conventions and shared helpers. Normal monsters have optional scripts. Keep media references separate from required script/data references.
- [x] T2.3. Build a developer conversion/export path from existing verified content to readable files without changing installed packages or saves. Preserve old official numeric codes, chapter/document/beat IDs, set memberships, rarity/printing fields and script bytes.
- [x] T2.4. Add a deterministic compiler producing compact per-pack JSON critical snapshots, source maps, release metadata and frozen-engine resource digests. Record compiler/schema version; stable ordering and byte encoding produce stable hashes.
- [x] T2.5. Exclude all media bytes/digests from critical startup signatures. Export artwork/audio/video as independent files without changing their content. Build verification may report optional media problems but must not refuse a valid gameplay package for them.
- [x] T2.6. Prove source-to-snapshot parity with the old catalog and semantic adapters. Keep generated/acquired full content out of Git.

Exit: identical card/search/deck/story behavior against the current release, repeatable snapshot hashes, human-discoverable installed layout, and no changes under `vendor/ocgcore-wasm/0.1.2/`.

## T3 Bulk native startup with trusted integrity

Requirements: R1, R2, R10.

- [x] T3.1. Implement a blocking-I/O worker behind asynchronous native startup commands. Read trusted release metadata, each critical base snapshot and engine resource once; hash and parse the same buffers. Do not run bulk work on the Tauri UI thread.
- [x] T3.2. Define a small number of logical transfer batches, session cancellation, phase progress and ownership. Avoid one command per card or per 500-row page. Initially use compact JSON metadata and binary executable transfer; benchmark before inventing a custom serialization format.
- [x] T3.3. Validate envelope/schema/executable compatibility, size and allocation bounds without repeating authoring-semantic checks for authenticated base snapshots.
- [x] T3.4. Normal mode does not enumerate base entity directories or mod folders. Missing/corrupt base snapshot fails closed; do not silently rebuild from edited readable sources.
- [x] T3.5. Separate startup content handles from the live media resolver; critical hashes never depend on image/audio/video contents.

Exit: trace proves a bounded set of base reads and zero source/mod enumeration in normal mode; hash mismatch produces T1 diagnostics; native UI remains responsive during preload.

## T4 Application lifetime content and domain projections

Requirements: R1, R6, R10, R12.

- [x] T4.1. Create an application-owned immutable catalog plus reusable search indexes and Freeplay/Story/Deck Editor projections. Remove I/O from projection functions and avoid retaining duplicate full card catalogs per domain.
- [x] T4.2. Prepare all installed active story graphs, set details, rules, deck/opponent data and Lua sources before ready, including data for later chapter transitions.
- [x] T4.3. Warm common screen modules and prepare the duel runtime through its public Worker-facing contracts. The main thread never imports or calls the engine. Audit transfer ownership so Worker teardown/restart does not require disk reads.
- [x] T4.4. Change session acquisition and domain navigation to memory references. Retain content on returning home; release only domain presentation/duel resources.
- [x] T4.5. Keep the shell startup gate until the complete critical snapshot is available; show honest phase progress rather than enabling routes that still need full content reads.

Exit: after ready, Freeplay/New Game/Continue/Deck Editor/later chapter/duel start and restart produce zero critical file reads. Original legality, concealed identity and replay/diagnostic invariants remain green.

## T5 Memory-authoritative user state and ordered persistence

Requirements: R1, R6, R7, R11.

- [x] T5.1. Acquire an exclusive app-data writer lock before reading user state. Block a second instance from becoming a writer, with an actionable diagnostic.
- [x] T5.2. Load and validate the complete current user JSON once, preserving supported schema handling and all namespaces. Corrupt files block startup; absent initial files get an explicit first-run empty state in memory.
- [x] T5.3. Replace `JsonUserDataStore.#read` use on operations with an initialized in-memory snapshot and record indexes. Retain existing mutation validation and expected record/global revisions against memory.
- [x] T5.4. Native writer owns a session token and durable revision receipt loaded at startup. Replace disk-source compare-and-swap with ordered revision checks. Preserve temp-file/flush/atomic-replace behavior and platform durability semantics.
- [x] T5.5. Separate accepted in-memory revision, pending writes, persisted revision and uncertain acknowledgement. Do not label unsaved state committed. Review Story checkpoint/handoff contracts so operations requiring persistence wait for the correct acknowledgement.
- [x] T5.6. Retry uses retained pending bytes/revisions, not disk rereads. Unknown outcomes suspend writes and request a new startup recovery cycle. Orderly exit flushes pending writes; forced exit leaves a complete previous/new file, never a partial JSON document.
- [x] T5.7. Backup export comes from memory. Stage restore/backup inspection in maintenance/startup state; explicit confirmation remains required for replacing user records. Do not scan backups as part of loading current user data.

Exit: native fault tests for interruption, disk/permission failure, duplicate/out-of-order writes and lost acknowledgement; external edits cannot change live state; every save/read/list/default-deck/settings path meets the no-read assertion.

## T6 Enabled mod discovery and explicit overrides

Requirements: R4, R5, R6, R9, R11.

- [x] T6.1. Load mode/root/enabled-mod preferences from the startup user snapshot. Add desktop folder selection and persistent platform access or app-managed import on mobile; changed selection applies on restart.
- [x] T6.2. Discover only allowed manifest/entity paths under enabled roots, bounded by count/size/depth. Read enabled critical mod files on every modded startup; do not let a cache bypass validation. Disabled mods are not parsed or executed.
- [x] T6.3. Check JSON syntax/schema/source locations, deterministic IDs/engine-code collision, dependencies, compatible base API/version, deck/set/card references and story entry/targets/terminals. Parse script syntax with a validator matched to the frozen engine language; isolate any executable smoke checks. Never execute scripts with native filesystem/process access just to discover content.
- [x] T6.4. Implement additions and schema-defined overrides. Resolve explicit dependency-backed conflict declarations; fail ambiguous writes with both source locations. Never mutate base source/snapshot files.
- [x] T6.5. Audit the frozen WASM/Lua imports and worker error/watchdog paths. Do not claim arbitrary script safety from syntax validation. Do not change the frozen vendor to implement this feature.
- [x] T6.6. Create a composed session identity; bind new modded saves to required mods and preserve existing base save semantics. Compare references against the resident base catalog without rescanning base source files.

Exit: malformed/duplicate/conflicting/missing-target/missing-script packs produce compiler-style diagnostics; valid additive and overriding mods affect gameplay through the engine; disabled-mod and base-only behavior remain unchanged. Stress-mod scan timing and memory are recorded.

## T7 Live media access and failure containment

Requirements: R8, R10, R12.

- [x] T7.1. Replace content BLOB reads with scoped live filesystem media lookup. Keep media logical IDs/path mappings in startup memory; new mappings require restart, while replacement of an already-mapped file is live. Recheck containment at access without reparsing gameplay JSON.
- [x] T7.2. Do not hash media or require existence/decode success for startup. A malformed media path is a nonfatal media refusal; do not relax containment or expose arbitrary native files.
- [x] T7.3. Generalize image leases, audio/video ownership, cancellation and revision handling. Use watcher invalidation where available and bounded visible-asset freshness checks otherwise. Corrected missing assets retry with backoff; rapid replacement coalesces work.
- [x] T7.4. Prevent stale requests overwriting newer revisions; release object URLs, decoders, listeners and buffers. Cache by logical asset and observed media revision with a bounded memory policy.
- [x] T7.5. Add placeholders, silence, video skip/error/timeout completion. Story event chains cannot wait indefinitely for media success; duel controls/identity and accessibility cannot depend on images.
- [ ] T7.6. Test truncated/replaced/deleted/malformed/oversized/unsupported media during active display and playback, plus repeated replacements and cache cleanup. Native decoder crashes are defects to fix or contain, not a reason to reject the content pack on launch.

Exit: actual native desktop and mobile cases keep input, story progression and duels usable while media fails/changes. Valid replacements appear on the next bounded refresh without restart; no unbounded retry/log/memory growth.

## T8 Complete startup admission and recovery experience

Requirements: R1, R6, R9.

- [x] T8.1. Integrate startup stages, cancellation and diagnostic aggregation. Publish ready only after critical data, user memory, mod composition, projections and engine preparation succeed.
- [x] T8.2. Present error counts, stable codes, file/mod identity, JSON pointer, available line/column, related locations and remedies. Group/suppress cascading errors like a compiler and state diagnostic truncation.
- [x] T8.3. Display the actual log path plus a direct working Open log action, open-folder/copy/export fallbacks, retry and quit. A failed log write shows copyable in-memory diagnostics instead of a false file link.
- [x] T8.4. Retry performs a complete new startup attempt after cleanup; no critical-data read silently occurs while an existing ready session runs. Mod disable requires an explicit user action and a new compatible startup, never automatic fallback into different gameplay.
- [x] T8.5. Ensure startup UI has accessible focus/announcements, keyboard/mobile operation, and unique `data-cy` attributes. Preserve active user files when reporting failures.

Exit: corrupt base hash, user JSON, mod JSON/Lua/story/decks/sets all report the correct origin and usable logs; no partial ready state; optional-media errors never enter this fatal path.

## T9 Cut over packaged runtime and document ownership

Requirements: R2, R3, R10, R11.

- [x] T9.1. Update native release preparation, resource staging, manifests and content tooling to readable sources, critical JSON snapshots and live media. Convert verified installed/developer SQLite content through an explicit content-only conversion tool or stage the new official release; do not delete user data or silently consume legacy saves.
- [x] T9.2. Activate complete critical release generations atomically in startup/maintenance state. Do not reseed over user-modified live media on every launch. Keep current session inputs fixed until exit.
- [x] T9.3. Retire production SQLite content-query/registry dependencies after parity, retaining only scoped conversion/fixture tooling where necessary. No dual production content authority.
- [x] T9.4. Update build guards and resource budgets, native IPC capabilities and tests. Raw content, media, scripts and OCG binaries remain outside the webview build. Public domain APIs and the frozen engine remain enforced.
- [x] T9.5. Mark ADR-104 clauses implemented only with evidence. Update ADR-101/102/103 cross-references, architecture routing, content-authoring/setup docs and AGENTS current-state wording. Update the durable manual checklist for each actually shipped slice, without altering owner feedback files.

Exit: clean native packaging and restart across old/new content generations, documented repair/conversion path, and no obsolete runtime SQL route reachable from the app.

## T10 Release evidence and regression gate

Requirements: all.

- [x] T10.1. Run focused unit/component/native tests per slice, then required repository headless/build/component/integration gates. Relevant existing commands: `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:component`, `npm run test:native:rust`, `npm run build`, `npm run build:reproducible`, `npm run test:native:webview`. Content verification commands must be updated by T9 before treating them as new-format evidence.
- [x] T10.2. Record unrelated baseline failures separately; never report a full green suite from focused checks alone. Node version must meet the repository's current engine requirement.
- [ ] T10.3. Run actual desktop and physical mobile launch/play/save/restart, media replacement and diagnostic opening tests. Browser bridge tests cannot prove native filesystem, durability, external opener or decoder behavior.
- [x] T10.4. Assert no critical reads after ready with the production native I/O tracer, including native save writer and in-memory Worker restart. Assert zero mod/source scans in normal startup.
- [ ] T10.5. Record cold/warm startup p50/p95, transfer count/bytes, route/search p95, frame stalls, resident/peak memory, mod scan scaling and media-cache growth. Compare to T0 budgets; no claims based only on warmed microbenchmarks.
- [x] T10.6. Update `artifacts/manual_test_checklist.md` with platform, fixture and expected outcomes for every shipped slice. Keep incomplete physical-device acceptance explicit.

Exit: evidence supports every requirement, architecture docs reflect actual implementation, and content-authoring instructions are usable without editing SQL. Stop at code-ready unless the user separately authorizes committing or release work.

## Review checkpoints

Review T2 schemas/identity/override semantics before integrating mod composition. Review T5 persistence acknowledgements and T7 media lifetimes before cutover. Review native telemetry and all failing-path evidence before marking complete. These are engineering verification checkpoints, not additional permission requests or instructions to spawn agents.

## Verification status — 2026-10-03

Checked implementation actions refer to the code and command evidence in `STARTUP_MEMORY_IMPLEMENTATION_EVIDENCE.md`; their ticket exit criteria still require the explicitly open platform acceptance. T7.6 is partially exercised: native desktop images plus component audio/video ownership/deadline cases; physical media playback remains open. T0.1/T0.4 cannot be checked from post-implementation measurements. T10.3/T10.5 remain open for physical hardware and unmeasured acceptance cases. The native fixture deliberately corrupts one mapped cover; production deck covers use cropped art only with an “Image missing” placeholder.

Recovery continuation: six actual optimized desktop webview scenarios pass corrupt user/base/mod inputs, missing mod root, explicit recovery, chapter removal/reimport and confirmed backup restoration. All four maintenance/readmission intervals retain and pass the native/frontend no-read assertion. Video Skip/deadline releases ownership immediately; Lua diagnostics report available source lines. Latest complete checks pass 3,005 unit + 9 performance, 58 integration, 1,416 component and 34 Rust tests, one Chromium bridge, frontend reproducibility and the default optimized native build. See evidence E29–E37; physical acceptance and missing WebKit runtime remain open.
