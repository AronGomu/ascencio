# T10 implementation report

State: **done — checked; independent acceptance pending**. Baseline: T9 accepted `344ffe2` per task input. Sole root writer; no subagents/stage/commit/push/live deploy.

## Evidence first

| ID | Check | Result | Evidence |
| --- | --- | --- | --- |
| V1 | Exact ticket Vitest | 14/14, exit 0 | `T10-EVIDENCE/green-vitest.log` |
| V2 | Exact ticket Chromium | 2/2, exit 0 | `T10-EVIDENCE/native-playwright.log`, `playwright-report.json`, two traces/screenshots |
| V3 | T9/basic regressions | 124/124 Vitest; 5/5 Chromium | `t9-basic-regressions.log`, `t9-native-regressions.log` |
| V4 | Build + frozen vendor | exit 0; Shell 99224 / 115000 | `build.log`; vendor 21/21; no budget/vendor edits |
| V5 | Types/scoped quality | 0 type errors; ESLint/Prettier clean; boundary/data-cy 87/87 | `typecheck.log`, `scoped-eslint.log`, `scoped-prettier.log`, `boundaries-data-cy.log` |
| V6 | Exact inventory | 27/27 source/test/config paths + SHA-256 | `source-paths.txt`, `source-sha256.txt` |

Paths above live under `artifacts/T10-EVIDENCE/` unless fully qualified. `commands-final.json` records commands/results. Local Chromium fixtures target `127.0.0.1`; no live R2/publication.

## Implemented

- I1. Shell `ContentActionsController` exposes independent Check updates, Install required data, Activate content, Download media, Pause/Resume, Delete unused, Delete all, Approve CORE actions. Installed selector is read before discovery; failed discovery changes message only. Downloads hold nonqueued cross-tab download lock through download/seal/preparation.
- I2. Optional media reads stay `ProgressiveContentStore.readFile` cache-only. Shell computes persistent missing count, renders fixed warning across Story/domain surfaces, never emits repeated toasts. Required-only local fixture opens Story with zero media GET.
- I3. Cleanup acquires application-exclusive then download-exclusive, refuses active sessions/jobs immediately. Delete unused preserves every active-manifest identity. Delete all CAS-clears only `selection.content`, retains Story generation, then removes only known Content rows/strict owned cache keys. Confirmation names removed downloads and retained saves/settings. Partial failure remains visible/retryable.
- I4. Build emits bounded `core-release.json` with exact `buildId`/compat epoch. Approval validates candidate and installed manifest under lifecycle lock, writes exact durable `coreApproval["approved"]`, then calls `registration.update()`. Different unresolved build rejects `CORE_UPDATE_PENDING`; same build is idempotent; activation checks current and pending target epochs.
- I5. Service Worker manually calls `addToCacheList` and gates `precache.install(event)` on matching durable approval. Strict first install requires no active worker and no prior Shell cache. No `skipWaiting`, `clients.claim`, forced reload, or automatic update call for existing registration. Cold unapproved B fails install and old A survives all tabs closing; approved B waits, then activates after close/reopen.

## Native observations

- N1. Required-only staged release performs zero `story/media/map.png` requests; production Story opens with “Optional media is missing. You can keep playing.” and one placeholder count. Screenshot: `media-placeholder.png`.
- N2. Populated Story generation save with DP=777, `localStorage` marker, Shell cache inventory, and unknown Content-cache key are byte/string-identical after Delete all. Selector advances generation 1→2 with `content:null` and same non-null Story generation. Strict owned Content keys/rows removed.
- N3. Unapproved build B produces no waiting worker/cache; closing/reopening remains on A. Explicit approval writes B before `registration.update`; B reaches waiting, remains while client open, activates after close/reopen. Screenshot: `core-approved-waiting.png`; trace under `test-results/core-update-consent-*`.
- N4. T9 native activation/save/recovery plus root/subpath/failed-precache/cold-update regressions pass 5/5 after consent integration.

## RED → GREEN

- R1. Retrospective T9-baseline run with final acceptance tests fails pending-target activation (received `activated`), manual SW install gate (`precache.addToCacheList` absent), and delete-all selector (`APP_STORAGE_UNAVAILABLE`). Current focused run passes 14/14. Evidence: `red-baseline-vitest.log`, `green-vitest.log`.
- R2. First current-tree focused run found one whitespace-sensitive confirmation assertion; UI copy was correct. Assertion normalized DOM whitespace; final 14/14. No product behavior weakened.
- R3. Strict D1/P1 test-first chronology was not met: implementation began before final named test files. Ticket leaves D1/P1 unchecked. Retrospective RED is genuine baseline evidence, not claimed as chronological TDD.

## Retained failure handling audit

- F1. No added `|| true`, redirected app failure, or unobserved failure-producing Promise.
- F2. `content-actions.ts` catches candidate fetch/parse only to map untrusted failures to `CORE_UPDATE_DISCOVERY_FAILED`; check failure preserves installed readiness. Missing/corrupt optional media catches increment persistent missing count. Action failures publish retry state then reject.
- F3. `InstallContentScreen.svelte` action `.catch(() => undefined)` sites suppress duplicate unhandled-rejection handling only after controller has published visible state. `register-service-worker.ts` registration catch sets visible `failed` state. App bootstrap retains repair controls for non-storage content failures.
- F4. Existing AppShell disposal/recovery catches and optional-media adapter catches remain unchanged in semantics. No cleanup wildcard DB/cache deletion added.

## Residual risks / skipped work

- K1. T11 locked asset prerequisite remains: missing official card/set assets and known full-unit/`assets:verify` failures. No asset acquisition or live R2 request attempted. Local isolated fixture only.
- K2. Full repository unit/assets checks were not rerun because task identifies T11 prerequisite; focused changed behavior, T9 regressions, boundary/data-cy, typecheck, build, vendor all pass.
- K3. Browser-origin eviction remains outside app control. Partial cleanup after selector clear is retryable because Delete all stays available; selector truthfully reports no playable Content.
- K4. Strict test-first chronology deviation requires reviewer disposition. Functional acceptance evidence passes.
- K5. Graph queried before edits; graph refresh deferred per task quota instruction.

## Assumptions

- A1. `#/install-content` is Shell lifecycle-management surface reached only from Main Menu; it counts as Main Menu-only because no domain session mounts and `isHome` explicitly recognizes only `""`, `#/`, `#/install-content`.
- A2. First install exemption means no active registration worker plus no owned Shell cache. Any prior owned cache removes exemption.
- A3. Existing unrelated untracked artifacts were preserved. Test-owned `.tmp/core-source-only-*` and `.tmp/t10-red` were removed by teardown/manual owned cleanup.

## Next action

Open `artifacts/T10-EVIDENCE/source-paths.txt`; perform required independent T10 review. Commit draft only: `feat(shell): keep updates and media under player control`.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "T10 explicit Shell actions, cache-only optional media, lifecycle/download-locked cleanup, durable exact-build CORE approval, manual SW install gate, pending epoch activation protection implemented; focused 14/14 and local Chromium 2/2 pass."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Exact 27-path inventory/SHA-256, command logs, baseline RED, GREEN, two native traces, screenshots, build/type/quality/T9 regression logs under artifacts/T10-EVIDENCE/."
    }
  ],
  "changedFiles": [
    "artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md",
    "artifacts/IMPLEMENTATION-REPORT-T10.md",
    "artifacts/PLAN_2026_09_13_content_module_rearchitecture/T10_update-media-cleanup.md",
    "e2e-core/content-media-cleanup.spec.ts",
    "e2e-core/core-update-consent.spec.ts",
    "e2e-core/offline-shell.spec.ts",
    "playwright.core.config.ts",
    "scripts/lib/vite-core-content.ts",
    "src/service-worker.ts",
    "src/shell/AppShell.svelte",
    "src/shell/application/application-bootstrap.ts",
    "src/shell/application/application-selector.ts",
    "src/shell/application/application-service.ts",
    "src/shell/application/application-state.ts",
    "src/shell/application/content-actions.ts",
    "src/shell/application/core-update-approval.ts",
    "src/shell/core/core-gate.ts",
    "src/shell/pwa/register-service-worker.ts",
    "src/shell/pwa/shell-cache-policy.ts",
    "src/shell/screens/InstallContentScreen.svelte",
    "src/shell/screens/MainMenuScreen.svelte",
    "src/vite-env.d.ts",
    "tests/component/InstallContentScreen.test.ts",
    "tests/component/content-installer.test.ts",
    "tests/component/core-menu.test.ts",
    "tests/unit/content-actions.test.ts",
    "tests/unit/core-content-transport.test.ts",
    "tests/unit/core-precache.test.ts",
    "tests/unit/core-update-approval.test.ts",
    "vite.config.ts"
  ],
  "testsAddedOrUpdated": [
    "e2e-core/content-media-cleanup.spec.ts",
    "e2e-core/core-update-consent.spec.ts",
    "e2e-core/offline-shell.spec.ts",
    "tests/component/InstallContentScreen.test.ts",
    "tests/component/content-installer.test.ts",
    "tests/component/core-menu.test.ts",
    "tests/unit/content-actions.test.ts",
    "tests/unit/core-content-transport.test.ts",
    "tests/unit/core-precache.test.ts",
    "tests/unit/core-update-approval.test.ts"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "14/14"
    },
    {
      "command": "npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts",
      "result": "passed",
      "summary": "2/2 local Chromium"
    },
    {
      "command": "npm run build",
      "result": "passed",
      "summary": "vendor 21/21; Shell 99224/115000; domain budgets pass"
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "0 errors; 4 existing warnings"
    }
  ],
  "validationOutput": [
    "Focused acceptance: 14 passed.",
    "Native Chromium: 2 passed with real SW cold-update approval plus cache-only media/cleanup preservation.",
    "T9/basic regression: 124 Vitest plus 5 Chromium passed.",
    "Boundary/data-cy: 87 passed; scoped ESLint/Prettier clean.",
    "Frozen vendor diff clean; no staged files."
  ],
  "residualRisks": [
    "Independent review pending.",
    "Strict test-first chronology not met; retrospective baseline RED retained and ticket D1/P1 unchecked.",
    "Known T11 missing locked card/set asset prerequisite remains; no live asset acquisition attempted."
  ],
  "noStagedFiles": true,
  "diffSummary": "Explicit independent content/media/CORE controls, persistent optional-media state, locked asset-only cleanup, durable exact-build SW approval gate, local two-build Chromium evidence; no vendor/budget/live deployment changes.",
  "reviewFindings": [
    "no self-review blockers found",
    "required independent acceptance pending"
  ],
  "manualNotes": "Graph refresh deferred per task quota. Existing unrelated untracked artifacts preserved."
}
```
