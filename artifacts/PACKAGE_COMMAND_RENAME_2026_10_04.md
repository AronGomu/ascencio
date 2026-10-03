# Package command cleanup and startup copy review

Status: done. Approved command cleanup implemented; startup loading explained and a standalone copy workbench opened in the existing browser session.

## Changes

- C1. `package.json` now exposes 60 commands with explicit frontend/native, acquisition/content, browser-test and legacy-tool scopes. The complete current registry is documented in [`development-commands.md`](../docs/development-commands.md).
- C2. Removed duplicate `build:native`, `test:native:webview` and `assets:sync:offline` aliases. Retained offline mode through `assets:upstream:sync -- --offline`.
- C3. Split readable-content dispatch into `content:convert:sqlite-to-json` and `content:compile:json`. Both support `-- --help`; no repeated subcommand is needed.
- C4. Updated npm chains, Tauri hooks, CI, Playwright server commands, CLI help/remediation messages, live guides and the durable manual test checklist. [`command-rename-map.json`](package-command-validation/command-rename-map.json) records exact mappings and the automated replacement scope.
- C5. The Linux launch command is `npm run native:build-and-start:linux`: Tauri builds with standalone custom-protocol support before launching the release executable. Existing launch instructions in `AGENTS.md` retain ordinary-launch instrumentation and verification requirements.
- C6. Added [`startup-loading-messages.md`](../docs/startup-loading-messages.md), with the current headings, conditional steps and source files. Production startup wording remains unchanged.
- C7. Added [`STARTUP_COPY_WORKBENCH_2026_10_04.html`](STARTUP_COPY_WORKBENCH_2026_10_04.html): 12 manually selectable states, current startup CSS/tokens/embedded fonts, editable headings/supporting text, three preview sizes, reset and JSON draft download. It performs no native loading or recovery actions.

## Validation

| ID | Evidence | Result |
| --- | --- | --- |
| V1 | [Red/green gate logs](package-command-validation/command-rename-red.log), [green](package-command-validation/command-rename-green.log) | Missing renamed build keys reproduced before edits; focused gate/storage contracts pass afterward. |
| V2 | [`npm run check:headless`](package-command-validation/command-rename-headless.log) | Exit 0: formatting, lint, types, 108 tooling tests, 3,006 unit tests, 9 performance tests, 58 integration tests, vendor/assets/source-manifest verification. Svelte check reports 0 errors and 4 existing warnings. |
| V3 | [`npm run frontend:build`](package-command-validation/command-rename-build.log) | Exit 0; frontend build boundaries and domain budgets pass. |
| V4 | [Conversion](package-command-validation/command-rename-convert.log), [compilation](package-command-validation/command-rename-compile.log) | Both actual npm wrappers succeed on a Freeplay SQLite fixture; generated JSON is preserved under `conversion-fixture/`. |
| V5 | [CLI help red](package-command-validation/command-rename-help-red.log), [help green](package-command-validation/command-rename-help-green.log) | Fixed help parsing after npm's fixed subcommand; both wrapper help invocations pass. Tauri build and bootstrap help also pass. |
| V6 | [`test:browser:native-bridge -- --project=chromium-desktop`](package-command-validation/command-rename-native-bridge.log) | 1 browser bridge test passed. This is a browser/native-IPC fixture, not an actual native launch. |
| V7 | [`test:browser:visual-acceptance`](package-command-validation/command-rename-visual.log) | All 41 Chromium visual acceptance tests passed. |
| V8 | [T3 copy-preview inspection](package-command-validation/startup-preview-verification.json) | All 12 headings match; editing/reset/cancel/retry work; draft export contains 12 states; 390-pixel frame has no horizontal overflow. Actual embedded fonts were observed loaded. |
| V9 | Command reference audit, local documentation-link audit, `git diff --check` | No retired npm references in active runtime/tooling/configuration or current guide scope; both new durable guides have valid local links; no whitespace errors. |
| V10 | [`graphify update`](package-command-validation/command-rename-graph-update.log), [clustering](package-command-validation/command-rename-graph-cluster.log) | Structural code graph refreshed: 14,210 nodes, 39,618 edges, 533 communities. Svelte extraction is partial for 115 files; semantic documentation extraction and LLM labels were not refreshed. |

The command-reference contract resolves every nested npm reference in package scripts, Tauri hooks, CI and Playwright configs. It also checks that ordinary Linux launches build through Tauri and that converter/compiler scripts dispatch the correct operation.

## Assumptions

- A1. Keep historical conversion/profile tools under explicit `legacy:` names rather than deleting their implementation; retained tooling tests and recovery procedures still use them.
- A2. Keep unit and performance checks combined under a descriptive name, preserving the existing isolated performance execution and aggregate coverage.
- A3. Preserve exact commands in completed plans, archived ADRs and historical handoff/evidence records. Their commands describe earlier runs rather than current instructions. `docs/SESSION_HANDOFF_2026-07-24_PROTOTYPES.md` is one such historical record.
- A4. A manually held reference preview is the safest way to review loading copy in context. Counters and failure diagnostics are illustrative; it is not a replay of timed native startup. Drafts live in page memory until downloaded; reload discards them.
- A5. Preserve the already-running owner application. No restart, native rebuild, save mutation or desktop configuration change was needed for this command rename.

## Limits and workspace preservation

- R1. This batch did not run the full `check` aggregate, Rust tests, SQLite/JSON parity, Android/iOS builds, physical-device acceptance or a fresh native launch. The named gates above were actually run; no broader acceptance is claimed. WebKit's previously observed missing ICU dependency remains a separate environment issue.
- R2. Broader pre-existing historical documentation contradictions outside command names were preserved. No unrelated documentation rewrite, vendor change or owner-feedback edit was made.
- R3. A preview automation attempt that replaced the live document in place timed out. Normal navigation to the final HTML restored the browser session; final 12-state checks passed. The standalone HTML opened successfully through `xdg-open` (`Opening in existing browser session.`).
- R4. Existing unrelated dirty/deleted files were preserved. No commit, push or pull request was made.
- R5. [SHA-256 retention receipts](package-command-validation/scratch-retention.json) record 27 owned files moved from `.tmp/` into validation artifacts and then removed from their original scratch paths. Only the owned conversion fixture's empty directories were removed. The preview HTTP server remains available for the collaborative browser.
