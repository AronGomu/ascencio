# ADR-104: Startup memory, readable content, mod overrides, and live media

> Status: implemented architecture; physical mobile and pre-change performance acceptance pending
> Date: 2026-10-01
> Scope: content authoring and loading, startup diagnostics, in-memory user state, persistence, and media replacement

The application prepares all gameplay-critical content and user records at startup, then uses memory for the lifetime of the session. Readable per-entity files support discovery and mod authoring. Normal mode loads a verified base snapshot; modded mode additionally validates enabled mods and composes their overrides. Images, audio, and video remain live, optional presentation assets whose failure never invalidates gameplay.

## Relationship to existing decisions

This decision replaces the target runtime's SQLite content transport and repeated content/user-data reads from ADR-099/100/101. It extends ADR-102 with explicit overrides and startup discovery, while preserving dependencies, stable identities, campaign facts, and separation of installed files from save prerequisites. It completes the filesystem-media direction left open by ADR-103. ADR-103's Tauri-only platform, Svelte UI, public domain boundaries, and native app-data storage remain.

The checked-in production runtime now loads digest-pinned JSON snapshots, retains prepared gameplay and user records in memory, and uses scoped live optional media. Rust SQL modules compile only for historical tests; production IPC exposes no SQL queries. Source conversion parity covers 14,794 cards, 13,549 scripts and 207 semantic queries. Desktop release webview acceptance exercises routes, a duel restart and save/continue with zero critical reads after ready. Physical mobile acceptance and a genuine pre-change native performance baseline remain unverified. Browser storage and legacy user-data migration remain retired. The frozen engine, loader resolution, and vendor manifest must not change.

## Motivation and evidence

Freeplay and Story currently prepare full catalogs when acquiring domain sessions. The single-library query path bypasses the composed-catalog cache; card pagination repeats native requests and package reads. User-data read/write operations also reread the JSON document. These patterns conflict with startup-only logical data reads.

A local experiment over 14,794 installed cards measured median bulk loading plus validation/index preparation at 76.7 ms for SQLite, 72.0 ms for compact JSON, and 78.5 ms for readable JSON. It used Node 24.19.0 on a Ryzen 7 7700 with a warm filesystem cache, 21 measured rounds, identical records, and identical search results. It excluded Rust/Tauri transport, media, scripts, sets, cold startup, and mobile. This supports JSON feasibility, not an end-to-end speed guarantee. Once prepared, the same in-memory representation searches identically regardless of its disk source.

## Content layout and identity

Base content ships with readable source files organized by entity, plus deterministic generated startup snapshots. Cards, sets, decks, opponents, and chapter/story documents have independently discoverable files. A card folder colocates `card.json`, optional `effect.lua`, and its artwork. Shared Lua helpers live once in the pack. A normal monster need not have an effect script.

```text
game-content/
  base/
    release.json
    cards/<stable-folder>/card.json
    cards/<stable-folder>/effect.lua
    cards/<stable-folder>/artwork.jpg
    sets/<stable-folder>/set.json
    decks/<stable-folder>/deck.json
    chapters/<stable-folder>/chapter.json
    chapters/<stable-folder>/events/<event-id>.json
    shared/scripts/
    runtime/<pack-id>.json
  mods/<mod-id>/manifest.json
  mods/<mod-id>/overrides/*.json
  mods/<mod-id>/cards/<stable-folder>/card.json
  mods/<mod-id>/scripts/
  mods/<mod-id>/media/
```

This describes a logical layout; native platform directories resolve its roots. Large generated/acquired data remains outside Git. Ship or install readable base files for discovery; do not make a repository checkout necessary to inspect the database.

Identity comes from explicit IDs inside files, never folder names, enumeration order, or array offsets. Existing official numeric card codes remain stable. Mod-added namespaced IDs require declared, collision-checked engine codes; do not derive codes from startup order or an unstable hash. A friendly schema uses named types/attributes/races, converted into frozen-engine values by the content compiler. Version the schema and compiler contract.

## Normal and modded startup

Normal mode does not enumerate mod roots or walk readable base entity files. Release generation fully validates base critical data and produces compact JSON snapshots containing definitions, text, sets, decks, opponents, rules, complete story graphs, asset references, and Lua source. Frozen engine executable bytes are a separate critical resource, verified and read during startup. Media bytes are excluded from critical snapshots and critical digests.

Startup reads each base snapshot once, hashes those bytes against trusted release metadata, and deserializes the same bytes. A matching hash authorizes skipping repeated authoring-semantic validation. Parsing, schema/version compatibility, size bounds, and executable compatibility still apply. The expected digest is anchored in bundled release metadata or an explicitly trusted installed-release record; an arbitrary adjacent editable hash file is not a trust anchor.

Hashing requires reading the hashed bytes. This design verifies consolidated runtime bytes, not every readable source file. Editing a readable base definition in normal mode neither changes the game nor silently regenerates a trusted snapshot. Source-to-snapshot consistency is checked by release tooling. Critical snapshot/engine mismatch blocks startup and directs the user to repair; media replacement does not affect these hashes.

Modded mode uses the same verified base snapshot without rescanning base files. It reads the selected enabled mod roots, parses all enabled critical mod files, checks schemas, scripts, IDs, dependencies, overrides, and references against the base catalog, and builds a single candidate catalog. Disabled mods are not parsed or executed. The mode/root/enabled selection is loaded with user preferences at startup. Desktop supports a chosen folder; mobile supports accessible platform roots or importing packs into app-managed storage.

Mod hashing is change detection, not proof of safety. A cached composed result never bypasses the requested validation of enabled critical mod data at startup. Media existence, contents, MIME/decoding success, and media hashes are not startup admission conditions. Invalid media paths must be refused by the media resolver without invalidating an otherwise valid pack; critical script/data paths that escape a permitted root are errors.

## Override composition

Mods add entities or apply explicit schema-defined changes to existing IDs. They never write base content. An override identifies the entity kind, target ID, compatible base release/API, and fields to replace. JSON selects an effect script; it does not execute its description as an effect. A declarative effect-template language is a separate future feature; engine-compatible Lua implements custom behavior in this scope.

The compiler defines replacement semantics per field; arrays are replaced unless a schema explicitly provides keyed operations. Reject unknown fields, missing targets, forbidden executable/core overrides, dependency cycles, duplicate added IDs, and invalid resulting entities. Preserve unchanged IDs and engine codes. Conflicting writes to the same entity field fail unless the later mod explicitly declares that it overrides the named earlier mod and the dependency order permits it. Directory order never decides precedence. Disjoint field overrides may compose deterministically.

Store enabled mod IDs, versions, critical hashes, and composition order in the session identity and new saves/diagnostics as needed for compatibility. Existing base-only saves remain base-only unless the user explicitly enters a compatible modded session. Do not silently interpret a save using a different required mod set or rewrite saves during content activation. Unknown campaign facts remain preserved.

## Memory and persistence contract

Before `READY`, load all current user records, preferences, saved decks, campaign saves, collections, read history, all installed active gameplay metadata, sets, critical story graphs, Lua scripts, and engine resources. Build validation results, lookup/search indexes, and reusable domain projections once. User data and content remain separate ownership concerns.

The application service owns shared content and authoritative live user state. Freeplay, Deck Editor, Story, and the duel obtain narrow in-memory capabilities. A domain unmount releases presentation resources, not the application catalog or user state. The dedicated duel Worker alone owns engine execution; synchronous callbacks consult preloaded maps. Worker restart must reuse retained in-memory resources without detaching the only surviving copy.

After `READY`, application-controlled gameplay/configuration/user-data/script reads are prohibited, including rereads hidden inside compare-and-swap writes, session acquisition, recovery, and mode switches. Asset reads and media filesystem metadata checks are allowed. Executable/platform loader activity and an explicitly opened diagnostic viewer are not gameplay-data reads. Common UI modules and the duel runtime should be warmed during startup to avoid first-use stalls.

Writes capture validated immutable snapshots of live state and pass through one ordered native writer. An app-data process lock prevents two application instances becoming writers. Native revision checks use the session's retained revision/receipt, not rereading `user-data.json`. Serialize, write a unique temporary file, flush, and atomically replace the destination using supported platform semantics. Acknowledge the exact persisted revision only after success. Track dirty and persisted revisions separately; failures retain current memory and unsaved status, with retry. Ambiguous outcomes suspend writes and report recovery requirements rather than guessing or rereading files during the session.

External critical-file edits do not affect the active game. A subsequent application save may overwrite external user-file edits; document that user files should be edited while the app is closed. Memory does not itself guarantee durable writes or protect against disk failure. Flush accepted pending writes on orderly exit; preserve the last complete file on interruption. Do not restore corrupt user data to defaults silently. Legacy stores remain unread.

Changes to mod selection, critical data, or save restore apply through a new startup cycle. Backup export serializes memory. External backup inspection/import and critical-content installation run in startup/maintenance state, never as an unnoticed exception while `READY`; validation and a new session follow. The recovery screen may retry startup after files are fixed. No critical-data hot reload during gameplay.

## Live noncritical media

Images, audio, video, and other purely presentational files are read lazily from permitted live roots. The player may replace, remove, or temporarily corrupt them while the game runs. This includes base artwork: immutable base gameplay data and live base media are distinct policies. Runtime readers perform no digest comparison or pack-admission validation of these assets.

Media must never drive legality, choice availability, story progression, or duel results. A missing video/audio completion event cannot deadlock an event chain: error, timeout, and skip paths complete the presentation step. Essential text, controls, hit areas, and card identity remain available without artwork. Invalid card media shows a placeholder; invalid sound is silent; invalid video shows a skippable fallback.

Contain load/decode/play failures, deleted/truncated files, unsupported codecs, and files changing during reads. Release replaced Blob URLs, textures, buffers, listeners, and leases. Invalidate visible asset caches on supported file notifications; provide bounded visible-asset freshness checks when watchers are unavailable. Retry missing/failed assets with backoff so corrected files can appear without restarting. Do not scan or hash the complete asset library to discover updates.

Retain path containment, allowed media use contexts, decode/resource limits, and presentation escaping. These are safe access and failure-containment rules, not content-integrity gates. Refused media remains nonfatal. Never interpret a mod asset as application HTML/JavaScript or grant it native capabilities. Coalesce repeated optional-media warnings in logs rather than interrupt play with repeated dialogs.

No application crash from media replacement is acceptable; any observed crash is a release-blocking defect for this feature. A decoder/platform crash cannot be guaranteed catchable in JavaScript: exercise actual native decoders and recoverable process boundaries where available, log available crash evidence, and fix or constrain the offending path. Do not advertise mathematical immunity to platform defects.

## Startup diagnostics and recovery

Initialize native logging and the minimal shell before installation checks, content hashes, user-data parsing, or mod discovery. The startup/error screen depends only on bundled app UI, not potentially broken game content or mod artwork. Use the existing Svelte/public-domain contracts and accessible controls with unique `data-cy` values.

The pipeline has explicit phases: log/session initialization, user-data read, base integrity, mod discovery, parsing, semantic validation, composition, memory preparation, engine preparation, ready/failed. Collect bounded independent diagnostics per phase; suppress misleading dependent cascades. Never activate a partially valid candidate or silently disable a broken enabled mod.

Each diagnostic carries a stable code, severity, phase, session ID, mod/pack ID where relevant, source file, JSON pointer and available line/column, concise message, expected/received detail when safe, related locations, and remedy. Preserve source locations while compiling files so semantic errors point to the author's JSON, not a generated array offset. Hash failures identify the critical file and expected/actual digest. Lua syntax errors map to the original script. Static story validation checks entry points, event/choice targets, required graph links, deck/set/card references, and explicit terminal semantics; valid authored loops are not rejected merely for being cycles.

The startup screen shows one overall percentage based on completed checkpoints within fixed phase ranges. Conditional phases are skipped; progress never decreases within an attempt and stays below 100% until admission succeeds. It estimates completed work rather than elapsed time, so atomic operations can pause the bar. Gameplay opens immediately after admission succeeds. There is no startup Cancel button; ordinary window closing still cancels work and releases ownership safely.

On error, show **Application could not start**, a concise player-facing error title and the actual error message. Keep exactly four actions in order: **Restore**, **Open Log**, **Copy Error**, **Close**. Restore uses authenticated bundled critical-content replacement and retries startup; it remains visible but disabled for unrelated save/mod failures. Open Log uses the actual written scoped path; no mod-controlled path becomes an arbitrary opener argument. Copy Error includes all bounded structured diagnostics, source locations and logging/action failures. If logging or an external opener fails, show that failure in the same summary and preserve copying. Save/mod corrections happen explicitly while closed and activate on reopening; no automatic disabling of mods or save replacement occurs.

Keep a structured session log and a readable compiler-style rendering; diagnostic limits and truncation are explicit. Example:

```text
mods/woodland/overrides/dragon.json:12:15
error MOD_OVERRIDE_TARGET_MISSING at /overrides/0/target
Card base:forest-dragon is absent from the active base catalog.
Expected a declared card ID. Check the target or the required base version.
```

Bound log size/retention. Log identities, phases, timings and diagnostics rather than complete saves, scripts, or concealed duel state. If disk logging itself fails, keep bounded in-memory diagnostics, state that the log could not be saved, and allow copying/exporting available details. Do not show a nonexistent file as successfully written. Runtime script exceptions, worker hangs, and save failures use the same diagnostic vocabulary but their recovery is domain-specific; startup checks cannot prove arbitrary scripts correct for every duel.

## Verification and cutover

Prove the no-read contract with instrumented native and frontend I/O boundaries after `READY`, not only mock-based UI tests. Cover navigation, save/setting/deck updates, Story transitions, duel startup/restart, backup export, and failure handling. Whitelist only media and explicit diagnostics actions. Normal mode must not enumerate source entities or mods; modded mode validates enabled critical mods while leaving base sources untouched.

Verify source/export determinism, old/new catalog parity, frozen-engine integrity, stable save IDs, mod conflicts, malformed startup content with source-located logs, and external edits during a session. Native media tests replace/delete/truncate/corrupt assets during presentation and prove continuing input, story progress, and duel correctness. Native persistence tests cover write races, full disk/permission failures, interruption, ambiguous acknowledgements, and single-writer behavior. Run Chromium/WebKit component integration plus actual desktop and physical mobile acceptance.

Measure cold and warm release-build startup phases, first/repeated navigation, search, native transfers, media decode stalls, peak/resident memory, and mod scan scale. Warm Node benchmarks are insufficient for release claims. Removing SQLite runtime content reads happens only after JSON snapshot and media parity; preserve conversion tooling for existing developer packages without introducing a second production authority or reading legacy user stores.
