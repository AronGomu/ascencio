# Startup memory, content and mods — manual acceptance

Status: implementation and automated coverage recorded separately from physical release acceptance. Use disposable app-data, never installed owner saves. This checklist covers the ADR-104 slice; the owner’s deletion of the prior historical checklist is preserved.

Reference desktop: AMD Ryzen 7 7700, Linux x86_64. Optimized native release with opt-in isolated acceptance instrumentation. No OS cache flush. Physical Android/iOS reference: unassigned; these checks remain open.

## Desktop native checks exercised

- [x] D1. Fresh app-data launch copies sources/media once and admits the main menu only after critical preparation. Verify: actual native acceptance report and ready marker; code at `src/shell/startup/StartupRoot.svelte`.
- [x] D2. Open Installed content and mod settings, return home, enter Freeplay, start/surrender/restart a duel and return. Verify: native 35-action acceptance passes with zero critical reads after ready.
- [x] D3. Open Deck Editor, start a new Story, save durably, return home and Continue. Verify: native acceptance and written current JSON; legacy stores remain unread.
- [x] D4. Replace, truncate, delete, oversize and write unsupported bytes to a mapped cropped cover while displayed; restore between failures. Verify: `STARTUP_MEMORY_CROPPED_PLACEHOLDER_ACCEPTANCE.json` passes native decoder fixture, usable Start control, “Image missing” placeholder (never full-card fallback), corrected image refresh and no global errors.
- [x] D5. Reenter Freeplay ten times, then close orderly. Verify: all native runs finish with zero live object URLs and successful process exit.
- [ ] D6. Use Open Log with the installed external handler. Verify: a real handler opens the actual written scoped path; a denied handler shows its failure and leaves Copy Error available.
- [x] D7. Fail startup with corrupt user JSON, bad base digest, malformed enabled mod JSON/Lua and missing mod root. Verify: actual desktop webview `STARTUP_SCREEN_OVERALL_NATIVE_RECOVERY_2026_10_04.json` has six passing recovery/maintenance cases, focused compact errors, written source-located logs, no partial main menu, preserved user records and exit 0. Base corruption uses Restore; other errors use Close, explicit host correction of disposable fixture preferences/user JSON, then reopening.
- [x] D8. Remove an optional chapter, restart preparation, import its exact pinned snapshot, restart again. Verify: actual desktop webview `STARTUP_MEMORY_MAINTENANCE_FINAL_ACCEPTANCE.json` passes; gameplay navigation blocked during maintenance, selection persists, representative user record survives. Campaign-fact preservation has separate native/unit coverage.
- [x] D9. Restore a backup, then restart preparation. Verify: same actual native report passes explicit UI confirmation and durable restore; restored mod preferences receive full startup admission. All four Ready intervals pass the independent no-read assertion.
- [ ] D10. Interrupt a process during a save and reopen. Verify: complete prior/new JSON, actionable unknown outcome, never partial JSON. Native fault tests cover write mechanics separately.
- [x] D11. Observe one overall startup bar across changing headings. Verify: native recovery report records nondecreasing progress per attempt, including gameplay checkpoints up to 99% before admission; Restore resets for a new attempt. Component coverage verifies no Cancel, stale events cannot move progress backward, and unfinished readiness never opens Main Menu.

## Mod gameplay and lifecycle

- [x] M1. Enable the isolated additive card/script/deck fixture and restart. Verify: added effect cards appear in the real engine’s player hand; save/Continue and Worker restart pass with zero critical rereads.
- [ ] M2. Change an enabled critical mod file while running, then restart. Verify: active gameplay stays fixed; restart validates the changed bytes.
- [x] M3. Leave a malformed disabled mod alongside enabled mods. Verify: actual native recovery captures read only the enabled JSON (one source read) or manifest plus Lua (two); disabled malformed manifest causes no diagnostic or read.
- [ ] M4. Enable two overlapping overrides without dependency-backed resolution. Verify: both writers are identified; disjoint field patches compose.
- [ ] M5. Resume a mod-bound save with changed/missing required mods. Verify: incompatible composition message; the save is preserved and no automatic base fallback occurs.

## Physical Android and iOS — pending

- [ ] P1. Assign real reference hardware/OS versions and install the packaged release offline. Verify: startup progress remains responsive, current defaults load and absent/corrupt critical files fail visibly.
- [ ] P2. Import the declared-file mod bundle into app-managed storage; enable and restart. Verify: persisted access, critical validation and real engine behavior; disabled mods remain unread.
- [ ] P3. Exercise New Game, Continue, Deck Editor, first duel, Worker restart, saves, return and repeated routes. Verify: production native traces show zero critical reads after ready.
- [ ] P4. Replace/corrupt/delete images, audio and video during display/playback. Verify: bounded refresh, placeholders/silence, skip/error/deadline completion, usable controls and no decoder crash.
- [ ] P5. Deny logging/opener access. Verify: accessible focused error summary, scoped written log only, Copy Error fallback and working Close/eligible Restore.
- [ ] P6. Measure fresh/warm launch, route/search p95, frame stalls, resident/peak memory and enabled-mod scaling. Verify: documented conditions and device budgets; browser viewports do not count as physical acceptance.
- [ ] P7. Background, force-stop and reopen during accepted writes. Verify: durable complete JSON and explicit failure/unknown-outcome recovery without legacy migration.

## Automated regression commands

- [x] A1. `npm run content:verify:sqlite-json-parity`: 207 semantic queries, 14,794 cards, 13,549 scripts and identical repeated snapshot bytes.
- [x] A2. `npm run test:native:rust`: authenticated maintenance/repair, cached writer, scoped containment, bounded logs and inert Lua syntax validation.
- [x] A3. `node scripts/verify-startup-io.ts artifacts/STARTUP_MEMORY_DESKTOP_IO.json`: independent native/frontend no-read gate.
- [x] A4. Final headless, component, Chromium native bridge, native/default build and frontend reproducibility commands. Verify: recovery continuation logs; 3,005 unit + 9 performance, 58 integration, 1,416 component and 1 native bridge pass; earlier cropped-only visual acceptance passes 41 tests. Rebuilt actual native recovery passes six scenarios in `STARTUP_MEMORY_RECOVERY_COMPLETE_ACCEPTANCE.json`.
- [ ] A5. Run all three WebKit native bridge projects after matching runtime dependencies are available. Verify: prior launch error `libicudata.so.74` is resolved and all projects execute; no cross-engine green claim before then.
