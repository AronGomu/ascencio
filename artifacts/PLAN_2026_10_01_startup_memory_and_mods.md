# Startup memory and mod content plan

Status: ready for implementation planning review; no runtime changes made.

Owner requirements are recorded in [ADR-104](../docs/ADR/104_ADR_startup_memory_content_and_mod_overrides.md). The [implementation plan](IMPLEMENTATION_PLAN_2026_10_01_startup_memory_and_mods.md) maps them to code and validation. These plans are ephemeral; the ADR contains the durable decision without depending on them.

## Intended experience

Launch once, prepare all critical content and user records, then navigate and play from memory. Normal mode verifies the prepared base snapshots and never scans readable base entities. Modded mode additionally scans and validates enabled mods. Authors inspect one folder per card and readable per-set/deck/story files; mods apply JSON overrides without editing the base. Images, audio and video remain live and optional, including base media. Corrupt critical content produces a useful startup screen and compiler-style log with a direct open action.

## Requirements and acceptance

| ID  | Requirement                                          | Observable acceptance                                                                                   |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| R1  | All critical data and user records loaded at startup | After `READY`, no gameplay/config/save/script reads across any domain                                   |
| R2  | Fast normal mode with trusted base hashes            | Each critical snapshot is read/hashed once; zero per-entity/base/mod scans                              |
| R3  | Readable base sources per entity                     | Installed content includes discoverable cards, sets, decks and chapter/event files                      |
| R4  | Optional mods folder and discovery                   | Only enabled mod roots are parsed; invalid enabled critical mods block activation                       |
| R5  | Explicit JSON overrides and additions                | Base is unchanged; IDs, field composition, dependencies and conflicts are deterministic                 |
| R6  | Immutable live gameplay session                      | External critical edits take effect only on next startup; no partial reload                             |
| R7  | Memory-first updates with atomic saves               | Ordered writer never rereads destination; dirty/persisted status survives save failures                 |
| R8  | Live optional media                                  | Replaced media refreshes; missing/invalid assets never block startup, controls or progression           |
| R9  | Early diagnostics and useful recovery                | Base/mod/user corruption yields source-located errors, persisted log path and working open/copy actions |
| R10 | Preserve game authority and boundaries               | Frozen engine unchanged; Worker owns execution; Svelte owns UI; domain imports remain legal             |
| R11 | Preserve saves and content identity                  | Existing supported records remain readable; new mod bindings detect incompatible composition            |
| R12 | Measured smoothness                                  | Release-build desktop/mobile timing, memory and no-read evidence accompany completion                   |

## Delivery sequence

1. Establish native timing/I/O evidence and contracts; build early diagnostics first so subsequent failures are inspectable.
2. Define readable entity schemas, stable IDs, compiler source maps, and deterministic compact JSON snapshots; establish parity against current content.
3. Implement startup verification and the application-owned in-memory catalog, then move Freeplay/Story/Deck Editor and engine input preparation onto it.
4. Replace repeated user-data reads and native disk compare-and-swap with single-writer session revisions and atomic writes.
5. Add enabled-mod discovery and explicit overrides with compiler-style validation. Existing base content remains authoritative unless explicitly overridden.
6. Move media to live filesystem access with bounded caching, cache invalidation and nonfatal fallbacks.
7. Complete startup/recovery UI, lifecycle and restart-only changes, then remove obsolete SQLite runtime content paths and verify packaged native builds.

The implementation plan orders narrower dependent tickets. Work remains on `main`; no concurrent agents or branch topology is required by this plan. Each slice is reviewable and preserves the current baseline until its replacement passes parity.

## Decisions fixed by this discussion

- JSON is the readable authoring format and the initial compiled metadata format. A custom binary serializer is not required for this round.
- All active critical content, all current user records, Lua source, and engine resources are prepared before ready. Media bytes are excluded.
- Readable per-card files are authoring/discovery material, not the normal-mode startup query surface.
- Critical hashes exclude media. Base hash mismatch is a startup error; media corruption is a runtime placeholder/silence/skip condition.
- Mod startup validates all enabled critical mod files. A fast cache must not silently skip this policy.
- No game-critical hot reload. Mod enable/disable/root changes and restores take effect through a startup/maintenance cycle.
- JSON overrides select scripts or data values. Generic JSON effect programming and executable app plugins are out of scope.
- No rewriting feedback files, changing the frozen engine, introducing browser persistence, or automatically migrating legacy saves.

## Engineering defaults

No further owner decision blocks this plan. Use declared engine codes for added cards, explicit dependency-backed precedence for conflicting overrides, an exclusive app-data writer lock, and a restart-required settings flow for critical changes. Keep the user-selected media files live; do not copy them into an immutable media snapshot. Use app-managed mod import as the mobile fallback when a persistent external folder is unavailable.

Performance budgets must be calibrated against the actual packaged app before optimization. Proposed interaction targets are p95 route-to-usable-controls under 100 ms on the desktop reference device and under 150 ms on the physical mobile reference device after ready, excluding optional media completion. Search computation should fit inside a frame (16 ms desktop, 32 ms mobile reference). Startup is measured separately and must stay responsive with real phase progress. The baseline ticket records cold/warm startup and memory budgets before implementation; these are engineering gates, not already measured results.

## Risks to resolve through implementation evidence

- One JSON export is not a benchmark of thousands of loose files. Measure enabled-mod scans at realistic and stress sizes.
- Full upfront scripts/story/user preparation increases memory. Avoid duplicate domain projections and unnecessary cross-thread copies; record peaks during preload and duel start.
- Hash verification reads critical bytes. Avoid hashing media or rereading the same snapshots; keep expected hashes anchored in trusted release metadata.
- Existing restore, session and native write code rereads files. The no-read gate must cover these paths and not be satisfied by caching only the card catalog.
- Media decode failures may originate below JavaScript. Test actual desktop/mobile decoders; fix or disable failing media paths rather than turning malformed media into a startup admission gate.
- Startup syntax validation cannot prove arbitrary Lua termination or behavior. Audit the frozen engine's capabilities and validate worker watchdog recovery without altering the vendor.

## Completion definition

All R1–R12 evidence exists; old/new base content parity and frozen-engine checks pass; critical errors are actionable; every supported media failure is nonfatal; writes are atomic and do not reread; actual native desktop/mobile acceptance is recorded. The durable manual checklist is updated with shipped behavior per slice. ADRs and routing docs are marked implemented only after the relevant gates pass.

Planning work itself changes documentation only. Runtime implementation, installation, deployment, commits, and pushes are not part of this planning deliverable.
