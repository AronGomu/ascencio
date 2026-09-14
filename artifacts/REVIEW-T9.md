# T9 independent acceptance review

State: **accepted**. Baseline reviewed: `c9466f69ef3d4f550ee70d986a2d7f36b4c924b1`.

## Review

- R1 Correct: sole selector authority uses `ygo-application-state` v1, `selection["active"]`; strict parser rejects malformed/sparse rows. CAS tx contains only IDB callbacks/requests; all manifest, Cache, Story, hash work occurs before tx. Evidence: `src/shell/application/application-state.ts:18-67`, `src/shell/application/application-state.ts:69-118`, `src/shell/application/application-selector.ts:75-115`.
- R2 Correct: activation takes nonqueued exclusive lifecycle lock before nonqueued exclusive download lock, rechecks generation/core/content, runs final `verifyRequired`, prepares/verifies Story seal, commits one selector CAS. Notification exceptions occur after commit and cannot change activated result. Evidence: `src/shell/application/application-selector.ts:63-130`.
- R3 Correct: domain session acquires shared lifecycle lease before selector read; readiness verifies selected content plus selected Story descriptor, uses generation cache, never rechecks mutable saves against preparation seal. Save repo tracks pending ops; close waits settlement before lease release. Evidence: `src/shell/application/application-locks.ts:17-49`, `src/shell/application/application-readiness.ts:43-112`, `src/shell/adapters/progressive-release-data.ts:64-108`.
- R4 Correct: Shell gates route render until leased acquisition completes; session remains across domain-to-domain/handoff routes, then closes after Svelte teardown plus tracked Worker disposal. Story, deck, collection, duel, admin mounts receive selected-session inputs; menu save ops acquire current shared lease independently. Evidence: `src/shell/AppShell.svelte:124-190`, `src/shell/AppShell.svelte:322-379`, `src/shell/AppShell.svelte:509-524`, `src/shell/AppShell.svelte:915-1143`, `src/shell/core/menu-saves.ts:5-32`.
- R5 Correct: production Story component receives selected native `GenerationSaveRepository`; Chromium test drives real Continue → Save confirmation → “Game saved.”, reloads exact envelope. Evidence: `src/shell/AppShell.svelte:1016-1042`, `e2e-core/atomic-content-activation.spec.ts:265-299`.
- R6 Correct: rejected save results, async/window errors, Svelte render errors, duel fatal/Worker errors route to recovery; recovery navigates home, drains disposal, releases lease, clears only readiness cache—not selector/saves. Evidence: `src/shell/core/session-saves.ts:3-30`, `src/shell/AppShell.svelte:198-225`, `src/shell/AppShell.svelte:791-804`, `src/shell/AppShell.svelte:859-864`, `src/battle/app/App.svelte:565-579`.
- R7 Correct: native evidence validates two-tab route locks, nonqueued download conflict, postcommit notification throw, normal saved-generation reopen, Worker termination, Cache eviction fail-closed behavior with unchanged selector/save rows. Evidence: `e2e-core/atomic-content-activation.spec.ts:127-447`; `artifacts/T9-EVIDENCE/native-trace.zip` contains 493 test-trace plus 875 browser-trace events; `artifacts/T9-EVIDENCE/native-recovery.png`; `artifacts/T9-EVIDENCE/native-storage-loss.png`.
- R8 Correct: chunk matcher now accepts only domain root + Vite eight-char hash, excluding semantic helper prefixes. Built output contains exactly `battle-BMgWBJge.js`, `deck-editor-Dl8Ih66S.js`, `story-FLjtwd50.js`; build verification reports Shell `95820 / 115000`, domain budgets passing. Evidence: `scripts/lib/domain-chunk-closure.ts:17-18`, `scripts/lib/domain-chunk-closure.ts:92-102`, `tests/unit/domain-chunk-closure.test.ts:72-90`.
- R9 Fixed: none; review-only.
- R10 Blocker: none.
- R11 Note: `changed-paths.json` contained all actual T9 source/test/tool paths; pre-validation hash scan found 121/121 paths present, 0 mismatches, 0 relevant omissions. Exact reviewer Playwright rerun regenerated nondeterministic `artifacts/CORE_ACCEPTANCE/T9/playwright-report.json` plus nested `trace.zip`, so their post-run hashes no longer equal author manifest; source inventory remains unchanged.

## Validation

- V1 `npx vitest run tests/unit/application-selector.test.ts tests/unit/application-readiness.test.ts tests/component/AppShell.test.ts --reporter=verbose` → passed, 59/59.
- V2 `npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/atomic-content-activation.spec.ts` → passed, 1/1; local `127.0.0.1` fixture only, no live endpoint.
- V3 `npx vitest run tests/unit/domain-chunk-closure.test.ts --reporter=verbose` → passed, 10/10, including built-tree lazy-root/headroom checks.
- V4 `npx vitest run tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts --reporter=verbose` → passed, 87/87.
- V5 `npm run build` → passed; vendor 21 files verified; Shell 95,820 bytes; battle 315,510; deck-editor 173,288; story 171,925.

## Residual risks

- K1 Deferred T11 prerequisites remain: missing locked card/set assets cause 4 known full-unit failures plus `assets:verify` failure. T9 changed-behavior checks passed; no acceptance waiver applied to T9 failures because none reproduced. Source: `artifacts/T9-EVIDENCE/final-unit.log`, `artifacts/T9-EVIDENCE/assets-verify.log`.
- K2 Existing unfiltered lint scratch/artifact config issue plus unchanged `e2e/asset-root-urls.spec.ts` format issue remain outside T9. Source: `artifacts/IMPLEMENTATION-REPORT-T9.md` “Residual risks / skipped work”.
- K3 Native acceptance blocks Service Worker, uses local verified fixture content. PWA update/discovery/media-cleanup integration remains T10 scope. Source: `e2e-core/atomic-content-activation.spec.ts:127-135`, `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T9_atomic-activation.md:312-313`.

## Assumptions

- A1 T11 asset/lint/format baseline exclusions treated exactly as task-directed residuals, not T9 acceptance blockers.
- A2 Generated Playwright report/trace hash drift from required reviewer rerun treated as validation side effect, not source defect; original retained `artifacts/T9-EVIDENCE/native-trace.zip` stayed intact.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "No blockers found. Concrete selector/CAS, lock, readiness, route, save, recovery, native-trace, and chunk-budget proof cited in artifacts/REVIEW-T9.md R1-R8."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T9.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/application-selector.test.ts tests/unit/application-readiness.test.ts tests/component/AppShell.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "59/59 focused T9 tests passed"
    },
    {
      "command": "npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/atomic-content-activation.spec.ts",
      "result": "passed",
      "summary": "1/1 native Chromium test passed against local fixture"
    },
    {
      "command": "npx vitest run tests/unit/domain-chunk-closure.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "10/10 matcher and built-tree tests passed"
    },
    {
      "command": "npx vitest run tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "87/87 boundary and data-cy tests passed"
    },
    {
      "command": "npm run build",
      "result": "passed",
      "summary": "Vendor and build budgets passed; Shell 95820/115000"
    }
  ],
  "validationOutput": [
    "Focused T9: 59 passed.",
    "Native Chromium: 1 passed; route/download locks, Story Save path, Worker recovery, Cache eviction exercised.",
    "Chunk matcher: exactly three lazy roots; 10 tests passed; build budgets passed.",
    "Source inventory before reviewer rerun: 121 paths present, zero hash mismatches, zero relevant omissions."
  ],
  "residualRisks": [
    "T11 missing asset prerequisites retain four known full-unit failures plus assets:verify failure.",
    "Existing scratch lint and unchanged e2e/asset-root-urls.spec.ts format issues remain outside T9.",
    "Native test uses local fixture content with Service Worker blocked; T10 owns update/discovery/media cleanup."
  ],
  "noStagedFiles": true,
  "diffSummary": "Read-only independent review accepted T9; only artifacts/REVIEW-T9.md added as review output.",
  "reviewFindings": [
    "no blockers: T9 acceptance contract verified against c9466f6 with source, focused tests, build output, screenshots, and native trace",
    "note: required Playwright rerun regenerated nondeterministic CORE_ACCEPTANCE report/trace hashes after initial 121/121 manifest validation"
  ],
  "manualNotes": "Accepted. No source edits, subagents, commit, push, live endpoints, or system apply."
}
```
