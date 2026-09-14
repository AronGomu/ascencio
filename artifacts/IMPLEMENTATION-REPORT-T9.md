# T9 implementation report

Open `artifacts/T9-EVIDENCE/native-trace.zip` for independent acceptance.

State: **done — checked; independent acceptance pending**. Baseline: `c9466f69ef3d4f550ee70d986a2d7f36b4c924b1`. Sole root writer; no children/stage/commit/push/deploy.

## Evidence first

| ID | Check | Result | Evidence |
|---|---|---|---|
| V1 | Exact ticket Vitest | 59/59, exit 0 | `T9-EVIDENCE/review-vitest.log` |
| V2 | Exact ticket Chromium | 1/1, exit 0 | `T9-EVIDENCE/review-native.log`; `native-trace.zip`; `native-observations.log` |
| V3 | Build + frozen vendor | exit 0; Shell 95820 / 115000 | `T9-EVIDENCE/review-build.log`; no budget edits |
| V4 | Types/source lint/scoped format | exit 0; 0 type errors, 4 existing warnings | `commands-final.json`; `review-types.log`; `review-lint.log`; `review-format.log` |
| V5 | Legacy/component/integration | 220/1237/54 passed | `legacy-full.log`; `component-full.log`; `integration-full.log` |
| V6 | Semantics/boundaries/data-cy/chunk roots | 152/152, exit 0 | `acceptance-boundaries.log` |
| V7 | Full unit | 2659 passed; 4 known asset failures | `final-unit.log`; failures below |

Paths above live under `artifacts/T9-EVIDENCE/` unless fully qualified. `commands.json` records exact commands/exits, including intended RED failures. `changed-paths.json` inventories every intentional source/report/evidence path; hashes exclude manifest's own self-hash.

## Implemented

- I1. Sole `ygo-application-state` v1 selector; `selection["active"]`, reserved `coreApproval` store. Strict unknown/sparse row refusal; defaults only for absent selector. IDB-only CAS transaction; no Cache/hash/Story/network awaits inside it. Evidence: `src/shell/application/application-state.ts:18,84`; `application-selector.ts:57,105,110`.
- I2. Nonqueued exclusive lifecycle → exclusive download; shared domain sessions acquire before selector/readiness/mount. Shell retains generation through Story→Battle→Story, drains pending repository operations and Worker disposal before release; closed repositories reject late operations. Menu operations reacquire current pair; write inputs snapshot before lock await. Evidence: `application-locks.ts:18,52`; `application-readiness.ts:43`; `src/shell/AppShell.svelte:124,132`.
- I3. Local selected semantic pair boots first, without legacy active bridge or network prerequisite. Per-generation preparation cache; `verifyActiveGeneration`, never preparation seal after ordinary writes. Story receives required release/Cards/repository; Battle receives fresh semantic runtime source; optional media uses pinned leases, missing media stays nonblocking. Evidence: `application-bootstrap.ts:33`; `application-readiness.ts:71`; `selected-gameplay.ts`; native actual Save UI + exact envelope reload.
- I4. Explicit async/save/Worker error channel plus root/awaited Svelte boundaries returns Main Menu after disposal. Postcommit notification exception remains activated success. Evidence: `src/shell/AppShell.svelte:198,859,1126`; `src/battle/app/App.svelte:452`; native constructed=2, terminated=2, lifecycle held=0; actual required Cache eviction leaves selector/every save row unchanged.
- I5. New semantic helper chunks exposed prefix ambiguity in existing budget matcher. Anchored default Vite eight-character hash roots fix measurement, not budgets. RED collision test → GREEN built-tree/lazy/headroom tests. Evidence: `scripts/lib/domain-chunk-closure.ts`; `tests/unit/domain-chunk-closure.test.ts`; `red-domain-budget.log`, `green-domain-budget.log`.

## Native observations

- N1. Two real tabs/native `navigator.locks`: Story, Free Play, deck library, collections, admin block activation immediately; no delayed generation change after release. Checkpoint reload → Battle → Story keeps shared lease.
- N2. Real local fixture download paused inside network wait: activation returns `APP_DOWNLOAD_ACTIVE`; completion never queues activation.
- N3. Notification callback throws after CAS: result stays activated, generation 2 authoritative.
- N4. Selected DP=9876 save survives offline reopen. Production Story Continue → Save confirmation → “Game saved.” writes injected repository; exact envelope survives page reload.
- N5. Native Worker thread error terminates both constructed Workers, returns Main Menu, releases lease, preserves saved DP. Actual required Cache eviction + reload locks play; selector/every Story row remain identical. Screenshots: `native-recovery.png`, `native-storage-loss.png`.

## RED → GREEN

- R1. Missing selector/readiness modules: exact `ERR_MODULE_NOT_FOUND`, exit 1 → implemented foundation, final 59/59.
- R2. Awaited Svelte constructor exception escaped root boundary: `Error: fixture render failure`, exit 1 → nested awaited boundaries, no unhandled rejection, automatic Main Menu.
- R3. Helper chunk mistaken for domain root, sparse selector acceptance, omitted pinned media, pre-lease write snapshot drift, foreign storage error misclassification: named RED logs retained; same assertions GREEN in final suites.
- R4. Native harness fixes: Vite build result array (`Error: Expected one fixture bundle`); later UI trace erroneously sought Main Menu after direct Story reload (`Test timeout of 180000ms exceeded.`). Harness corrected, final production UI/native trace passes. No product assertion weakened.

## Retained failure handling audit — V3

- F1. No added `|| true`, empty catch, hidden redirected failure, unobserved failure-producing Promise. Validation stdout/stderr redirected only to retained logs; exit status recorded.
- F2. `application-readiness.clear()` rejects old preparation via already-observed `acquire` path; its rejection arm has nothing to dispose. Disposal exceptions separately log `APP_DISPOSAL_FAILED`. Pending-operation settlement observers update drain set; original Promise remains caller-observed.
- F3. Lock request errors reject session entry; aborted/superseded route acquisition is intentionally ignored only after releasing returned session. Selector parser transaction aborts → `APP_STORAGE_UNAVAILABLE`; activation catches → fixed typed failure union. Notification observer/reporting exceptions log only, never reverse committed result.
- F4. Required import/read/save/Worker failures forward to recovery; optional T8 media absence/corruption remains null. Expected `BattleRequestError` remains typed deck refusal. Disposed view results release leases/images rather than update dead views. Existing unrelated catch sites preserved.

## Residual risks / skipped work

- K1. Full-unit T11 prerequisites remain: `chapter-one-image-lock.test.ts` acquired set roster mismatch; `Error: ENOENT: no such file or directory, open 'assets/shared/card-images/cropped/32864.jpg'`; `content-setup-authoring.test.ts` readiness mismatch; `content-setup.test.ts` readiness mismatch. `assets:verify` reports missing locked set images. These source/assets paths unchanged; no live acquisition attempted.
- K2. Full lint traverses prior `.tmp/worktrees/core-integrate` config (`No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present:`), then prior artifact scripts. Full source lint passes with only scratch/artifact exclusions. Full format flags unchanged `e2e/asset-root-urls.spec.ts`; intentional source paths pass.
- K3. Native local fixtures, not official delivery/rights/publication. Service Worker blocked to isolate locks; CORE update/media cleanup policy belongs T10. Graph queried once; quota-constrained refresh intentionally skipped.
- K4. No physical cross-DB atomicity claim. Prepared orphan generations retained. No legacy saves/settings/Content deletion or fallback selection. Browser storage eviction fails closed rather than attempting repair/download.

## Assumptions

- A1. Empty selector stays locked. T10 owns explicit discovery/install/update presentation; operational `createApplicationService` exposes guarded activation/download seam now. No legacy installer opens on production startup.
- A2. Task-requested route `openai-codex/gpt-6-astra:high`; child runtime exposes no model metadata. No subagent launch performed.
- A3. Existing unrelated untracked artifacts preserved. Harness-owned `.tmp/core-source-only-root` and `.tmp/core-source-only-subpath` removed by test teardown; generated `dist/**` excluded from intentional source inventory.

## Next action

Open `artifacts/T9-EVIDENCE/changed-paths.json`; perform required independent T9 review. Commit draft only: `feat(shell): activate matching content and saves atomically`.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "T9 sole selector CAS, nonqueued locks, selected generation readiness/injection, disposal/recovery implemented. Exact ticket Vitest 59/59; native two-tab production Story Save UI, Worker termination, Cache eviction proof."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Complete path/hash inventory, exact commands/exits, red/green logs, native trace/screenshots/DB assertions in artifacts/T9-EVIDENCE/. Independent review remains pending."
    }
  ],
  "changedFiles": [
    "e2e-core/atomic-content-activation.spec.ts",
    "scripts/lib/domain-chunk-closure.ts",
    "src/battle/BattleFacade.svelte",
    "src/battle/app/App.svelte",
    "src/shell/AppShell.svelte",
    "src/shell/application/application-bootstrap.ts",
    "src/shell/application/application-locks.ts",
    "src/shell/application/application-readiness.ts",
    "src/shell/application/application-selector.ts",
    "src/shell/application/application-service.ts",
    "src/shell/application/application-state.ts",
    "src/shell/application/core-startup.ts",
    "src/shell/application/selected-gameplay.ts",
    "src/shell/core/core-gate.ts",
    "src/shell/core/menu-saves.ts",
    "src/shell/core/session-saves.ts",
    "src/shell/core/shell-application.ts",
    "src/shell/screens/DomainLoadError.svelte",
    "src/shell/screens/FreePlayMatchSetup.svelte",
    "tests/component/AppShell.test.ts",
    "tests/fixtures/ApplicationFailureProbe.svelte",
    "tests/fixtures/application-locks.ts",
    "tests/fixtures/atomic-application-browser.ts",
    "tests/unit/application-readiness.test.ts",
    "tests/unit/application-selector.test.ts",
    "tests/unit/core-gate.test.ts",
    "tests/unit/domain-chunk-closure.test.ts",
    "artifacts/IMPLEMENTATION-REPORT-T9.md",
    "artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md",
    "artifacts/PLAN_2026_09_13_content_module_rearchitecture/T9_atomic-activation.md",
    "artifacts/CORE_ACCEPTANCE/T9/playwright-report.json",
    "artifacts/T9-EVIDENCE/changed-paths.json",
    "artifacts/T9-EVIDENCE/commands.json"
  ],
  "testsAddedOrUpdated": [
    "e2e-core/atomic-content-activation.spec.ts",
    "tests/component/AppShell.test.ts",
    "tests/fixtures/ApplicationFailureProbe.svelte",
    "tests/fixtures/application-locks.ts",
    "tests/fixtures/atomic-application-browser.ts",
    "tests/unit/application-readiness.test.ts",
    "tests/unit/application-selector.test.ts",
    "tests/unit/core-gate.test.ts",
    "tests/unit/domain-chunk-closure.test.ts"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/application-selector.test.ts tests/unit/application-readiness.test.ts tests/component/AppShell.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "59/59; review-vitest.log"
    },
    {
      "command": "npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/atomic-content-activation.spec.ts",
      "result": "passed",
      "summary": "1/1 native Chromium; review-native.log"
    },
    {
      "command": "npm run build",
      "result": "passed",
      "summary": "Shell 95820/115000; frozen vendor verified; all domain budgets pass"
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "0 errors; 4 existing warnings"
    },
    {
      "command": "npm run lint -- --ignore-pattern '.tmp/**' --ignore-pattern 'artifacts/**'",
      "result": "passed",
      "summary": "Complete source tree passes; prior scratch/artifact scripts excluded"
    },
    {
      "command": "npm run test:unit",
      "result": "failed",
      "summary": "2659 passed; 4 existing asset-prerequisite failures in 3 files"
    },
    {
      "command": "npm run test:component",
      "result": "passed",
      "summary": "1237/1237"
    },
    {
      "command": "npm run test:integration",
      "result": "passed",
      "summary": "54/54"
    },
    {
      "command": "npm run test:legacy",
      "result": "passed",
      "summary": "220/220"
    },
    {
      "command": "npm run format:check",
      "result": "failed",
      "summary": "Unchanged e2e/asset-root-urls.spec.ts formatting warning; changed source paths pass"
    },
    {
      "command": "npm run assets:verify",
      "result": "failed",
      "summary": "Known T11 missing acquired images; no acquisition attempted"
    },
    {
      "command": "npm run snapshot:verify",
      "result": "passed",
      "summary": "Pinned local runtime snapshot verified"
    }
  ],
  "validationOutput": [
    "Ticket Vitest: 59 passed.",
    "Native Chromium: 1 passed; actual Story Save UI envelope survives reload; two Workers constructed/terminated; required Cache eviction retains selector and every save row.",
    "Boundary/semantic/data-cy/build-root checks: 152 passed.",
    "Legacy/component/integration: 220/1237/54 passed.",
    "Full unit: 4 asset-prerequisite failures retained; full lint/format baseline noise documented."
  ],
  "residualRisks": [
    "Independent acceptance pending; author does not self-accept.",
    "T11 missing acquired card/set media retains four full-unit failures plus assets:verify failure.",
    "Unfiltered lint traverses prior .tmp worktrees/artifact scripts; full format flags unchanged e2e/asset-root-urls.spec.ts.",
    "Native test uses local verified fixtures and frozen vendor, Service Worker blocked; no live release/publication/assets acquired.",
    "T10 explicit discovery/install/update/media cleanup UI deferred; empty selector intentionally stays locked."
  ],
  "noStagedFiles": true,
  "diffSummary": "Shell-owned atomic content/save visibility, cross-tab lifecycle/download coordination, cached selected semantic inputs, normal-save-safe reload, explicit async/Worker/Svelte recovery. Narrow budget-root matcher repair prevents helper chunk miscounting; no budget/vendor/package/legacy-store source changes.",
  "reviewFindings": [
    "Required independent review pending.",
    "Author checks found and repaired awaited Svelte constructor boundary gap, helper chunk prefix collision, sparse selector rows, pre-lease write snapshot drift, foreign DB storage-error classification."
  ],
  "manualNotes": "Review artifacts/IMPLEMENTATION-REPORT-T9.md and artifacts/T9-EVIDENCE/changed-paths.json. No stage/commit/push/deploy. HEAD remains c9466f69ef3d4f550ee70d986a2d7f36b4c924b1. Complete commands in commands.json; generated dist output excluded from intentional-source inventory."
}
```
