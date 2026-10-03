# Agreed startup screen implementation

## Plan and success criteria

- [x] P1. Replace the live loading/error presentation with the approved preview: no Cancel; overall startup percentage; heading/title/message and Restore, Open Log, Copy Error, Close. Verify: 106 focused tests pass, including startup progression, keyboard/error focus and unique data-cy checks (`startup-screen-overall-green-fixed.log`).
- [x] P2. Emit progress after completed native/storage/gameplay work, mapped to one monotonic overall percentage. Verify: focused tests pass; Rust tests pass (34 passed, 2 ignored); actual native samples in `STARTUP_SCREEN_OVERALL_NATIVE_RECOVERY_2026_10_04.json` advance through verification, engine and gameplay without resetting and stay below 100 until admission.
- [x] P3. Preserve scoped log opening, full structured error copying, safe quit and bundled-content restoration. Verify: component action/logging failures pass; all six isolated native recovery/maintenance cases pass, preserve user records and exit 0 in the same report. Actual external handler acceptance remains separate.
- [x] P4. Update live documentation, manual checklist and obsolete recovery selectors. Verify: final headless checks and 1,421 component tests pass; normal Tauri release build succeeds; build boundaries pass; actual logs retained under `startup-screen-validation/`.

## Assumptions

- A1. The owner clarified that the percentage represents the whole startup. Estimate completed startup work using fixed phase ranges and actual completed checkpoints; skip inactive optional ranges, never move backward within an attempt, cap at 99 until READY, then 100. This is a work estimate, not an elapsed-time prediction or timed animation. Long atomic operations can pause the bar.
- A2. Restore uses the existing bundled critical-content repair. Keep its button visible but disabled for failures that cannot be fixed by restoring bundled content, including bad saves and mods.
- A3. Show the first error's player-facing title and actual message; preserve all source locations, expected/received details and independent diagnostics in scoped logs and Copy Error.
- A4. Keep owner saves and any running application session untouched. Native verification uses isolated disposable fixtures. No commits, pushes or physical-device acceptance are in scope.

## Evidence

- E1. Initial red tests: six failures captured in `startup-screen-red.log`; implementation green: 106 focused tests pass in `startup-screen-overall-green-fixed.log`. Earlier action-error regression caught loss of the opener error during copying, then passed after preserving the error before clearing action state.
- E2. Final `npm run check:headless`: exit 0; 108 tooling, 3,008 unit, 9 performance and 58 integration tests pass; format, lint, types, vendor, assets and snapshot gates pass. Existing four Svelte warnings remain. Log: `startup-screen-overall-headless.log`.
- E3. Final `npm run test:component`: exit 0; 1,421 tests across 148 files pass. Log: `startup-screen-overall-components.log`.
- E4. `npm run test:native:rust`: 34 passed, 2 ignored. Chromium bridge: 1 passed; visual acceptance: 41 passed. Logs: `startup-screen-rust.log`, `startup-screen-browser-bridge.log`, `startup-screen-browser-visual.log`. Browser suites preceded the overall-percentage clarification; subsequent component and actual native acceptance cover that correction.
- E5. Final actual native recovery: six scenarios pass, every process exits 0, user markers survive and Ready intervals pass the no-critical-read gate. Observed overall checkpoints include 25/30/35/40/45% verification, 50/55% engine verification and 77–99% gameplay preparation. Reset occurs only for a fresh attempt after Restore or reopening. Report: `STARTUP_SCREEN_OVERALL_NATIVE_RECOVERY_2026_10_04.json`; log: `startup-screen-overall-native-recovery.log`.
- E6. Final ordinary release: `npm run native:desktop:build -- --no-bundle`, exit 0. Built `src-tauri/target/release/ascencio` through Tauri with normal custom-protocol resources and no opt-in acceptance feature. Existing two Rust dead-code warnings remain. Log: `startup-screen-native-default-build.log`. Owner application was not relaunched.
- E7. Code graph refreshed and reclustered: 14,234 nodes, 516 communities. Parser reports partial extraction for 116 Svelte files; document semantic extraction was not refreshed. Logs: `startup-screen-overall-graph-update.log`, `startup-screen-overall-graph-cluster.log`.
- E8. Source: `StartupRoot.svelte`, `StartupProgressBar.svelte`, `startup-percentage.ts`, `startup-error-title.ts`; existing storage/native/gameplay checkpoints now report completed work. Phase weights are explicit in `startup-percentage.ts`. The standalone copy preview and loading-message documentation describe overall completion.

## Remaining acceptance

- R1. External installed Open Log handler, physical Android/iOS and matching WebKit runtime dependencies remain separate acceptance checks. Scoped opener invocation and error-copy fallback have component coverage.
- R2. Collaborative preview opened the updated standalone page, then snapshot timed out and the tab became unavailable. No new screenshot or visual claim is based on that attempt; native behavior has independent actual-webview evidence.
- R3. Existing unrelated dirty/deleted/untracked workspace content is preserved. No owner feedback or frozen vendor changes were made. Own scratch logs are archived with SHA-256 receipts before removal; cleanup receipt lists exact removed paths.
