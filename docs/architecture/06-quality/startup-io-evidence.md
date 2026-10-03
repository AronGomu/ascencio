# Startup I/O evidence

Status: production startup admission and native/frontend tracing implemented under ADR-104. Physical mobile and a genuine pre-change native baseline remain separate acceptance gates.

`ready` means pinned critical snapshots and executable compatibility, current user memory, enabled mod composition, all active chapter projections, retained search indexes, Worker engine preparation and common screen modules have completed. Optional media and OS/webview module loading are separate from logical critical-data reads. Contracts live in [`startup.ts`](../../../src/storage/contracts/startup.ts) and [`io-trace.ts`](../../../src/storage/contracts/io-trace.ts).

Set `ASCENCIO_IO_TRACE=1` on an isolated native process. Every trace uses a shared session ID and bounded sequence/timing records. Native categories cover registry, engine, gameplay, user data, optional media, diagnostics and explicit maintenance; the frontend categorizes IPC with the same contract. Rotation and trace truncation are stated. A missing marker, pending event, dropped event or malformed capture fails verification.

Normal startup reads selected critical snapshots, two executable buffers and current user JSON. It does not enumerate source directories or disabled mods. First installation separately copies readable authoring sources and optional media; that installation work is explicitly recorded. Modded startup always reads enabled declared critical files and validates them afresh.

## Capturing an isolated desktop run

```sh
npm run native:desktop:build -- --no-bundle
mkdir -p .tmp/startup-native-data .tmp/startup-native-config
XDG_DATA_HOME="$PWD/.tmp/startup-native-data" \
XDG_CONFIG_HOME="$PWD/.tmp/startup-native-config" \
ASCENCIO_IO_TRACE=1 src-tauri/target/release/ascencio
```

Never use installed owner user data for fault or performance fixtures. Android/iOS capture uses platform-specific app-managed test storage and physical hardware.

After ready, exercise Freeplay, Deck Editor, New Game, save/Continue, Worker restart and repeated return/reentry. Optional media may read; accepted user mutations may write. Critical content/config/user reads may not cross or follow a ready marker until an explicit maintenance or new-startup marker closes that admission interval. Verification checks every interval in the retained trace: a later preparation cannot hide an earlier illegal read. Explicit package verification, import and backup inspection enter maintenance and prevent gameplay reentry until a new preparation cycle.

With tracing enabled, the webview diagnostic global `__ASCENCIO_IO_TRACE__.snapshot()` returns one native/frontend capture. The capture refuses concurrent trace changes. Persist it as JSON and check it independently:

```sh
node scripts/verify-startup-io.ts capture.json
```

The historical `baseline-ready` marker remains available for migration experiments; it is not current gameplay admission.

## Opt-in actual webview fixture

The Cargo `native-acceptance` feature, `ASCENCIO_NATIVE_ACCEPTANCE=1`, tracing, and an app-data parent named exactly `startup-native-data` are all required for the isolated automated release fixture. Default optimized builds exclude media-mutation commands and automatic fixture execution. The fixture has no caller-selected native paths. Its fixed media changes can target only the isolated authenticated starter-cover mapping.

The fixture performs route/play/save/restart actions in the actual desktop webview, tests corrected optional media, records object URL cleanup and exits through the ordinary close handler. It writes acceptance and ready trace JSON in the native log directory. Timing runs must state the instrumentation feature; a bridge or warmed Node metadata benchmark does not count as native acceptance.

The Linux desktop recovery runner authenticates and copies only critical resources into disposable app-data. Optional media is intentionally absent; this is recovery acceptance, not an installation or playback measurement. It exercises corrupt user JSON, base digest mismatch, enabled mod JSON/Lua failure, a missing mod root, and chapter removal/reimport plus confirmed backup restore. Its disabled malformed mod remains unread. The runner verifies the compact error summary and Restore/Open Log/Copy Error/Close order. A base failure uses Restore; save/mod failures use Close, then the host explicitly corrects only disposable fixture JSON while its writer is closed and reopens for full admission. This does not add hidden production recovery or automatically disable owner mods. It checks focused errors, written logs, preserved user records, ordinary exit and every native/frontend admission interval. A DOM observer records the actual overall startup percentage and rejects invalid values or decreases within an attempt; Restore and reopening begin fresh attempts. Existing output files are refused.

```sh
npm run frontend:build
cargo build --manifest-path src-tauri/Cargo.toml --release --features tauri/custom-protocol,native-acceptance
node scripts/verify-native-startup-recovery.ts recovery-capture.json
# Optional final argument selects one scenario, for example maintenance.
```

Restart preparation preserves the Installed content route. The fixture accepts that route after readmission rather than requiring Main Menu. External log-handler opening and physical audio/video playback require their own acceptance.

## Evidence limits

Desktop optimized native runs have exercised 35 actions, optional media corruption/recovery and orderly save/close with zero critical reads after ready. Source parity covers 207 semantic queries over 14,794 cards and 13,549 scripts. A modded native fixture adds effect cards and Lua scripts and overrides a deck, then saves/continues under its composed identity.

Measure fresh app-data separately from warm launches; state whether OS caches were flushed. Process-family RSS double-counts shared pages; PSS apportions them. Report sampling intervals, input sizes, transfer bytes/count, search computation separately from render/input latency, and sample counts alongside p50/p95. Post-implementation observations cannot satisfy the plan’s requirement to establish budgets before implementation. Proposed route/search targets remain 100/16 ms desktop and 150/32 ms physical mobile; device acceptance and calibration remain explicit.
