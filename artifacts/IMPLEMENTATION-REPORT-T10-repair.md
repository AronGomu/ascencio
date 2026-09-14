# T10 B1–B5 repair report

State: **done — checked; required independent repair review pending**. Sole root writer. No subagents/stage/commit/push/live deployment. Initial report/review/evidence preserved byte-identical.

## Evidence first

| ID | Check | Result | Evidence under `artifacts/T10-REPAIR-EVIDENCE/` |
| --- | --- | --- | --- |
| V1 | Exact ticket Vitest | 29/29: 14 original + 15 repair | `green-vitest-final-2.log` |
| V2 | Exact ticket native Chromium | 2/2 | `native-playwright-final.log`, `native-final/playwright-report.json`, `native-final/test-results/**/trace.zip` |
| V3 | Atomic/offline/basic regressions | 124/124 Vitest; 5/5 native | `regressions-vitest.log`, `native-regressions-final.log`, `native-regressions-final/playwright-report.json` |
| V4 | Boundary/data-cy | 87/87 | `boundaries-data-cy.log` |
| V5 | Build/types/scoped quality | Shell 99224/115000; vendor 21/21; types 0 errors/4 existing warnings; lint/format clean | `build-final.log`, `typecheck-final-2.log`, `scoped-eslint-final.log`, `scoped-prettier-final.log` |
| V6 | Inventory/preservation | 27/27 combined paths; 8 repair paths; prior hashes unchanged; staging empty | `source-paths.txt`, `source-sha256.txt`, `repair-source-paths.txt`, `inventory-final.log` |

Exact cmds, timestamps, exit codes: `commands.json`. Full acceptance JSON: `acceptance.json`. Incremental production diff: `repair-source.diff`; pre-repair production source retained in `before/`.

## Repaired findings

- B1. `src/shell/application/content-actions.ts`: CORE metadata reads stream into fixed 4096-byte buffer, rejects/cancels overflow before accumulating remainder, releases reader lock. Absent/lying Content-Length tests observe exactly five 1024-byte pulls then one cancel; exact 4096-byte valid metadata accepted. Header remains early rejection only, never trusted body bound.
- B2. Discovery exposes failed Content or CORE channel explicitly. Successful channel retains candidate/action; selected offline Content/Story pair unchanged. Current CORE plus failed Content no longer reports up-to-date. Dual failure retains existing fixed offline-failure copy.
- B3. Lifecycle epochs invalidate superseded check/preparation/download completions. Local inspection checks final selector generation after awaited media reads; retries current generation before publishing. Delayed check after local Delete all cannot restore stale metadata/actions; independent generation change during discovery recomputes canInstall from final selector. Superseded prepared release disposed; old progress ignored. Partial Delete all failure clears staged activation immediately after selector clear, remains visible/retryable.
- B4. Missing-media count filters same runtime + already dependency-closed selected chapter packs as media download. Shared file counted once; unselected chapter media ignored. Two-chapter fixture counts 3 selected/runtime/shared entries, reaches 0 after selected media download despite absent other-chapter entry. Delete unused still retains whole active-manifest identities.
- B5. Application broadcast invokes cache-only controller refresh; no fetchLatest/cacheManifest/download. Media completion sends change notification. Broadcast does not dispose active domain readiness merely because media changed. Native second tab loses stale warning/download/activation controls after cleanup. SW read-only `CORE_BUILD_IDENTITY` message reports compiled build ID/epoch from actual controlling worker, independent of cache naming.

## Native observations

- N1. Required-only staged release opens Story, Free Play setup, actual Deck Editor, collection, real-WASM duel. Persistent missing-media warning remains visible; optional media HTTP count stays zero. Screenshots: `native-final/media-placeholder.png`, `media-free-play.png`, `media-free-play-decks.png`, `media-free-play-collection.png`, `media-duel.png`.
- N2. Isolated Delete all advances selector 1→2, clears Content only, retains non-null selected Story generation. Populated Story slots and Decks DB hashes identical before/after; setting marker, populated CORE cache marker bytes, unknown Content-cache key retained. Second-tab controls/warning refresh without reload. `native-final/media-native-observations.json`, `native-final/cross-tab-cleanup.png`.
- N3. Native update method wrapper reads exact durable `coreApproval["approved"]` via completed readonly IDB transaction before calling original `registration.update()`. Approval equals candidate schema/build/epoch plus actual selected generation and bounded observed timestamp. No mocked update/worker install path. `native-final/core-native-observations.json`.
- N4. Active controller reports A after cold unapproved B plus offline reload; A still controls while approved B waits; B controls after all tabs close/reopen plus offline reload. Cache assertions remain additional evidence, not identity authority. Two-build production harness uses only `127.0.0.1`.

## Chronological repair RED → GREEN

- R1. Before any production repair, new defect assertions fail: `red-vitest.log`, exit 1, 10 failures / 15 passes. Failures cover stream cancellation, partial discovery, local deletion race, final selector, media closure, broadcast stale read, late preparation.
- R2. Before SW identity impl, `red-native.log` fails `"CORE controller identity timeout"`. Native media setup needed bounded fixture corrections: library opens via tile double-click; real duel requires existing official Lua globals instead of placeholder comments; observer enters installer via Main Menu rather than pre-existing broken cold direct route. Failed setup logs retained as `red-native[-2/-3].log`; no product assertions removed.
- R3. Corrected native test still fails intended cross-tab defect before source repair: `red-native-4.log`, expected disabled, received enabled. Initial repair then passes focused 25/25 and native 2/2. Follow-up media broadcast test fails once before notification impl (`red-broadcast-completion.log`); final 29/29. Added stale-progress and partial-delete assertions are preservation regressions, not claimed additional pre-repair RED.
- R4. Final self-check found refreshed canInstall could re-enable an already prepared candidate. Added focused case first (`red-prepared-action.log`, exit 1), then compared candidate manifest identity in action availability; final 29/29 (`green-vitest-final-2.log`). Native/build/type/quality rerun on final source.
- R5. Initial T10 strict D1/P1 remains unchecked permanently. Repair chronology does not retroactively satisfy initial chronology. Initial retrospective evidence untouched. First typecheck exposed only new fixture typing/stub gaps; repaired, final typecheck passes.

## Failure handling / scope audit

- F1. No new `|| true`, wildcard cleanup, forced reload, `skipWaiting`, `clients.claim`, vendor edit, budget edit, or weakened acceptance assertion. Prior lock order/nonqueued busy checks, strict cache ownership, Story selection and pending CORE compatibility contracts retained; exact regressions pass.
- F2. New `application-service.ts` notification `.catch(() => undefined)` observes refresh rejection only after controller publishes visible local-storage failure. Superseded action completions intentionally cannot publish into current generation. Existing optional-media catches count missing; required-input errors remain distinct.
- F3. No full-unit/assets validation claim: known T11 locked asset prerequisite deferred. Native fixtures copy existing local required Lua globals plus frozen WASM into isolated hashed release; no public R2/CDN transfer or live install performed.
- F4. Native harness-owned `.tmp/core-source-only-root`, `.tmp/core-source-only-subpath` removed by teardown; no other scratch/user files deleted. Evidence deliverables retained. Prior T10 report, review, all evidence hashes verified unchanged.

## Assumptions

- A1. Approved B1–B5 repair scope includes read-only controller identity evidence seam, controller-local refresh method, optional evidence-output env override. No public domain export widening.
- A2. Staged `chapterIds` already dependency-closed per `sealRequired`/`verifyRequired`; media count uses that exact closure, no duplicate chapter resolver.
- A3. Existing local `assets/shared/data/current/scripts/globals.json` plus `scripts/index.json` provide fixture Lua for real-WASM play. These inputs remain untouched; synthetic cards/release, browser DBs, cleanup targets isolated.
- A4. Known graph quota/backend failure inherited; no graph backend retries or refresh attempted. Existing unrelated dirty/untracked work preserved.

## Residual risks / next action

- K1. Required independent acceptance pending; ledger/ticket updated, never self-accepted.
- K2. Original strict TDD chronology remains unmet; D1/P1 unchecked permanently.
- K3. T11 asset prerequisite/full-unit-assets gate remains deferred.
- K4. Pre-existing cold direct `#/install-content` can show `"Content controls are unavailable. Reopen from Main Menu."` despite ready content. Reproduced before repair in `red-native-3` error context. Menu entry works. Outside reviewed B1–B5; unchanged.

Next: reviewer opens `artifacts/IMPLEMENTATION-REPORT-T10-repair.md`, checks B1–B5 against `source-paths.txt` plus native observations/traces. No commit/stage/push performed.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "B1\u2013B5 repaired in 3 production files; 8 repair source/test/config paths total. Original 14 tests + 15 repair cases pass. No vendor/budget/live-deployment changes."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Chronological RED/GREEN logs, exact command timestamps/exits, 27-path combined SHA-256 inventory, 8-path repair inventory, two native production traces plus 5 native regressions, approval/controller and media/preservation JSON under artifacts/T10-REPAIR-EVIDENCE/; independent review pending."
    }
  ],
  "changedFiles": [
    "e2e-core/content-media-cleanup.spec.ts",
    "e2e-core/core-update-consent.spec.ts",
    "playwright.core.config.ts",
    "src/service-worker.ts",
    "src/shell/application/application-service.ts",
    "src/shell/application/content-actions.ts",
    "tests/component/InstallContentScreen.test.ts",
    "tests/unit/content-actions.test.ts",
    "artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md",
    "artifacts/PLAN_2026_09_13_content_module_rearchitecture/T10_update-media-cleanup.md",
    "artifacts/IMPLEMENTATION-REPORT-T10-repair.md",
    "artifacts/T10-REPAIR-EVIDENCE/"
  ],
  "testsAddedOrUpdated": [
    "e2e-core/content-media-cleanup.spec.ts",
    "e2e-core/core-update-consent.spec.ts",
    "tests/component/InstallContentScreen.test.ts",
    "tests/unit/content-actions.test.ts"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "failed",
      "summary": "exit 1; artifacts/T10-REPAIR-EVIDENCE/red-vitest.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/red-native npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts",
      "result": "failed",
      "summary": "exit 1; artifacts/T10-REPAIR-EVIDENCE/red-native.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/red-native-2 npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts",
      "result": "failed",
      "summary": "exit 1; artifacts/T10-REPAIR-EVIDENCE/red-native-2.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/red-native-3 npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts",
      "result": "failed",
      "summary": "exit 1; artifacts/T10-REPAIR-EVIDENCE/red-native-3.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/red-native-4 npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts",
      "result": "failed",
      "summary": "exit 1; artifacts/T10-REPAIR-EVIDENCE/red-native-4.log"
    },
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/green-vitest-1.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/green-native-1 npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/green-native-1.log"
    },
    {
      "command": "npm run typecheck",
      "result": "failed",
      "summary": "exit 2; artifacts/T10-REPAIR-EVIDENCE/typecheck-1.log"
    },
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "failed",
      "summary": "exit 1; artifacts/T10-REPAIR-EVIDENCE/red-broadcast-completion.log"
    },
    {
      "command": "npx prettier --write src/shell/application/content-actions.ts src/shell/application/application-service.ts src/service-worker.ts tests/unit/content-actions.test.ts tests/component/InstallContentScreen.test.ts e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts playwright.core.config.ts",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/prettier-write.log"
    },
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/green-vitest.log"
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/typecheck.log"
    },
    {
      "command": "npx prettier --write e2e-core/content-media-cleanup.spec.ts",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/prettier-native-final.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/native npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/native-playwright.log"
    },
    {
      "command": "npx vitest run tests/unit/application-selector.test.ts tests/unit/application-readiness.test.ts tests/unit/core-precache.test.ts tests/unit/core-content-transport.test.ts tests/unit/progressive-download.test.ts tests/unit/progressive-storage.test.ts tests/component/AppShell.test.ts tests/component/core-menu.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/regressions-vitest.log"
    },
    {
      "command": "npx vitest run tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/boundaries-data-cy.log"
    },
    {
      "command": "npm run build",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/build.log"
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/typecheck-final.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/native-regressions npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/atomic-content-activation.spec.ts e2e-core/offline-shell.spec.ts",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/native-regressions.log"
    },
    {
      "command": "xargs -a artifacts/T10-REPAIR-EVIDENCE/source-paths.txt npx eslint",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/scoped-eslint.log"
    },
    {
      "command": "xargs -a artifacts/T10-REPAIR-EVIDENCE/source-paths.txt npx prettier --check",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/scoped-prettier.log"
    },
    {
      "command": "xargs -a artifacts/T10-REPAIR-EVIDENCE/source-paths.txt sha256sum > artifacts/T10-REPAIR-EVIDENCE/source-sha256.txt && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/source-sha256.txt && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/prior-report-sha256.txt && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/prior-evidence-sha256.txt && git diff --quiet -- vendor/ocgcore-wasm/0.1.2 scripts/verify-browser-build.ts && git diff --cached --quiet && git diff --check",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/inventory-integrity.log"
    },
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/green-vitest-final.log"
    },
    {
      "command": "git diff --cached --quiet && git diff --check && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/source-sha256.txt && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/prior-report-sha256.txt && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/prior-evidence-sha256.txt && test ! -e .tmp/core-source-only-root && test ! -e .tmp/core-source-only-subpath",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/final-state.log"
    },
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "failed",
      "summary": "exit 1; artifacts/T10-REPAIR-EVIDENCE/red-prepared-action.log"
    },
    {
      "command": "npx prettier --write tests/unit/content-actions.test.ts src/shell/application/content-actions.ts",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/prettier-followup.log"
    },
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/green-vitest-final-2.log"
    },
    {
      "command": "npm run build",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/build-final.log"
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/typecheck-final-2.log"
    },
    {
      "command": "xargs -a artifacts/T10-REPAIR-EVIDENCE/source-paths.txt npx eslint",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/scoped-eslint-final.log"
    },
    {
      "command": "xargs -a artifacts/T10-REPAIR-EVIDENCE/source-paths.txt npx prettier --check",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/scoped-prettier-final.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/native-final npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/native-playwright-final.log"
    },
    {
      "command": "T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/native-regressions-final npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/atomic-content-activation.spec.ts e2e-core/offline-shell.spec.ts",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/native-regressions-final.log"
    },
    {
      "command": "xargs -a artifacts/T10-REPAIR-EVIDENCE/source-paths.txt sha256sum > artifacts/T10-REPAIR-EVIDENCE/source-sha256.txt && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/source-sha256.txt && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/prior-report-sha256.txt && sha256sum --check artifacts/T10-REPAIR-EVIDENCE/prior-evidence-sha256.txt && git diff --quiet -- vendor/ocgcore-wasm/0.1.2 scripts/verify-browser-build.ts && git diff --cached --quiet && git diff --check && test ! -e .tmp/core-source-only-root && test ! -e .tmp/core-source-only-subpath",
      "result": "passed",
      "summary": "exit 0; artifacts/T10-REPAIR-EVIDENCE/inventory-final.log"
    }
  ],
  "validationOutput": [
    "Focused ticket Vitest: 29/29 (14 baseline + 15 repair).",
    "Native ticket Chromium: 2/2; five required-only domains including real WASM duel; zero media HTTP; cross-tab stale actions cleared.",
    "Exact approval row observed after readonly transaction completion before native update; active controller A remains on cold unapproved/offline reopen, A while B waits, B on approved cold/offline reopen.",
    "Regressions: 124/124 Vitest; 87/87 boundaries/data-cy; 5/5 native atomic/offline.",
    "Build passes unchanged budgets, Shell 99224/115000, frozen vendor 21/21. Types 0 errors/4 existing warnings; 27-path scoped ESLint/Prettier clean.",
    "27/27 hashes valid; original T10 report/review/evidence unchanged; git diff --cached --quiet exits 0."
  ],
  "residualRisks": [
    "Independent acceptance required; ticket/ledger pending.",
    "Original strict D1/P1 chronology missed permanently; remains unchecked. Repair RED/GREEN chronology recorded separately.",
    "T11 locked card/set asset prerequisite deferred; full-unit/assets checks not rerun; no live asset acquisition.",
    "Pre-existing direct cold navigation to #/install-content can render \"Content controls are unavailable. Reopen from Main Menu.\" despite ready content. Menu entry works; unchanged outside B1\u2013B5. Evidence red-native-3 error-context.md.",
    "Native duel fixture reads existing local assets/shared/data/current/scripts/globals.json and scripts/index.json, bundles them into isolated hashed required-only release; missing local scripts would block fixture setup."
  ],
  "noStagedFiles": true,
  "diffSummary": "Bounded CORE stream; per-channel discovery failures; lifecycle epochs/final selector reconciliation; exact selected media count; cache-only broadcast refresh; read-only SW identity; stronger isolated native evidence. Existing cleanup locks, save selection, strict owned keys, partial-failure retry retained.",
  "reviewFindings": [
    "Required independent B1\u2013B5 repair review pending; no self-acceptance.",
    "Out-of-scope direct cold installer-route issue recorded; no adjacent UI rewrite."
  ],
  "manualNotes": "Sole writer; no subagents/stage/commit/push/system apply/live deployment. Earlier artifacts preserved. No graph backend retries. Native harness-owned .tmp/core-source-only-root and .tmp/core-source-only-subpath removed by teardown. Reviewer opens artifacts/IMPLEMENTATION-REPORT-T10-repair.md next."
}
```
