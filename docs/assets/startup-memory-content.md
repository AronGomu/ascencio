# Readable content, mods and startup ownership

The production app uses ADR-104 startup snapshots and live filesystem media. Rust reads and authenticates critical content once; the shell prepares all installed chapters, search indexes and Worker inputs before admitting gameplay. User records remain in one initialized memory store with an exclusive native writer. Production IPC has no SQLite content-query handler. SQLite remains developer conversion and historical test input only.

## Build and authoring

A1. Acquire/export the verified historical packages with the existing content acquisition tools. Convert each package into a **new** directory, without opening installed saves:

```sh
npm run content:convert:sqlite-to-json -- generated/content-packages/card-library-1.1.0.sqlite generated/readable-content-v1/card-library
```

A2. Repeat conversion for every package in `content/packages.json`. Installed authoring sources have `pack.json`, `config.json`, per-entity JSON files and per-card folders. `pack.json` lists critical files explicitly. A normal monster's Lua script is optional. Cards retain all engine values and localized strings; named classification fields compile to engine masks. Explicit masks preserve unknown official bits and must agree with named known bits.

A3. Compile and check parity, then review and pin the release:

```sh
npm run content:compile:json -- generated/readable-content-v1/card-library generated/readable-content-v1/card-library
npm run content:verify:sqlite-json-parity
npm run content:release:pin
npm run content:stage:native
npm run content:stage:verify-native
npm run native:desktop:build -- --no-bundle
```

The compiler writes `critical.json`, `source-map.json` and engine digests deterministically. `content/critical-release.json` is the tracked trust anchor embedded by Rust; staged metadata must match it. `content:stage:native` refuses unpinned changes and atomically replaces only its marked stage. Artwork/audio/video bytes never enter critical hashes. Generated sources, media and packages remain ignored.

## Installed layout and maintenance

Native app-data contains `critical-generations/<release-identity>/` for verified snapshots/engine bytes, `readable-content/<package-id>/` for discoverable sources and live media, `mods/<mod-id>/` for managed imports, and separate `user-data.json`. Normal startup reads the selected snapshots, two executable resources and one current user document. It does not walk base source or mod directories. First installation copies sources/media once; existing files are preserved, and complete copied files publish atomically.

Installed content imports accept exact digest-pinned `critical.json` files from the bundled release. Authored changes belong in mods or a newly reviewed application release. Core packages remain required so the installer stays reachable. Optional chapters can be removed from the next-startup selection; campaign facts and saves stay untouched. Maintenance blocks gameplay navigation until **Restart preparation**. Verification explicitly reads critical files in maintenance. Cleanup does not delete retained trusted generations, quarantined repair copies, authoring files, media or saves.

Startup hash failures offer **Repair bundled critical content and retry**. Repair verifies bundled bytes before publishing a complete replacement, retains the previous critical generation as a quarantine copy, and leaves user data and edited media alone. Corrupt user JSON blocks admission; it is never silently reset. Edit current user files only while the application is closed: external edits cannot change a running session and can be overwritten by its next save.

Backup export serializes memory. Backup inspection enters explicit maintenance; restoring still requires confirmation and durable acknowledgement. Restart preparation afterwards so restored preferences and mod selection receive full admission checks. Unknown write outcomes suspend further writes and require reopening; ordinary failures retain dirty memory and exact retry bytes. Orderly native close drains pending writes.

## Mod manifests and overrides

B1. A root contains enabled `<mod-id>/mod.json` directories. IDs are lower-case slugs. The manifest has exact keys `schemaVersion: 1`, `id`, semantic `version`, `contentApi: 1`, `base`, `dependencies`, `entities`, and `media`. Base entries pin `{packageId, version}`; dependencies pin `{id, version}`. Every entity/media target declares its base package version.

B2. Entity declarations use `{kind, packageId, operation, id, path, resolves}`. Kinds are `cards`, `scripts`, `sets`, `decks`, `opponents`, `limits`, `stories`, `config`; operations are `add` or `override`. Paths are relative, bounded and explicitly listed. Cards/scripts/sets target a card-library module. Engine resources and Duel Core configuration cannot be overridden.

B3. Additions supply complete entities. Cards may use the same readable `{schemaVersion, id, engine, classification, texts}` format as base sources, or `{id, definition, texts}`. New IDs use `<mod-id>:<local-id>`; code `0` requests the deterministic, collision-checked engine code. Official overrides preserve their numeric code. A script declaration named `card:<namespaced-id>` maps to that card's assigned `c<code>.lua`. Effect monsters require a script; Lua 5.3 syntax validation never executes discovery files.

B4. Overrides may provide a complete replacement or `{ "fields": { ... } }`. Field overrides recursively replace named record fields; arrays replace completely. Unknown fields and identity changes fail. Disjoint field writes compose. Overlapping writes require an explicit dependency on each prior writer plus its ID in `resolves`; filesystem order never sets precedence. For example, a Freeplay config override file can contain:

```json
{"fields":{"title":"My freeplay title"}}
```

B5. Deck zones and set printing codes accept resident numeric codes, `official:<code>`, or declared namespaced card IDs. Story documents retain stable document/beat/choice IDs. Optional `chain` nodes identify beats, explicit next/choice targets and terminals; reachable loops with a terminal path are allowed. Optional node media uses `{kind, logicalId, timeoutMs}`. Invalid critical references stop startup with file/pointer diagnostics.

B6. Media declarations use `{packageId, id, path, mime, operation, resolves}`. Their mappings enter startup memory; bytes stay live and optional. Unsafe/missing/corrupt/oversized media is refused or shown as a placeholder, silence or skippable video fallback. Corrected visible mappings refresh with bounded polling/backoff. Changing the mapping itself requires restart.

B7. Package a declared-file mobile import:

```sh
npm run mods:bundle -- my-mod generated/my-mod.bundle.json
```

Import the bundle through Installed content, select app-managed storage, enable its ID and select modded mode. Desktop may instead select a filesystem root. Changes apply on restart; disabled mods are not read. Bundles have a 128 MiB encoded limit and 64 MiB payload limit; missing optional media may be omitted. Existing managed IDs are never overwritten by import. New modded Story saves record composition IDs/versions/hashes and refuse a mismatched composition on Continue.

## Diagnostics and verification

Logs initialize before content. The startup screen shows compiler diagnostics, actual written log path, scoped Open log/folder, copy/export fallbacks, explicit mod disable, repair, retry and quit. Disk log failure retains bounded copyable details. A mod path is never an opener argument.

Use `ASCENCIO_IO_TRACE=1` for bounded native/frontend evidence. [`startup-io-evidence.md`](../architecture/06-quality/startup-io-evidence.md) documents capture and gates. Frozen host imports can be inspected with `npm run mods:audit:wasm-imports -- <new-report.json>`; syntax validation is not a claim that arbitrary Lua is correct or cannot hang. Worker error/watchdog disposal remains required.

Desktop optimized acceptance covers startup, Story save/Continue, Deck Editor, duel start/restart and repeated routes with zero critical reads after ready. Physical mobile decoder, durability and performance acceptance remains a release gate; browser bridge tests do not replace it.
