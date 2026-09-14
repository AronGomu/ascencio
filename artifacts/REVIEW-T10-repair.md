# T10 B1–B5 independent repair acceptance

State: **accepted — clean for B1–B5**. Review mode: read-only source inspection plus local validation. No source/test edits, staging, commit, push, external network call, or system apply.

## Review

- R1 Correct — B1 bounded streaming. `fetchCoreCandidate` treats `Content-Length` only as early rejection, allocates fixed 4096-byte buffer, stops before copying overflow, cancels response/reader, releases lock: `src/shell/application/content-actions.ts:118-167`. Absent plus lying-low header overflow tests assert five 1024-byte pulls plus one cancellation; exact 4096-byte valid body succeeds: `tests/unit/content-actions.test.ts:298-344`.
- R2 Correct — B2 independent failure channels. Content/CORE settle independently; successful channel retains actionable candidate while failed channel yields explicit failure copy; dual failure preserves offline-safe copy: `src/shell/application/content-actions.ts:425-497`. Content failure + current CORE cannot report up-to-date: `tests/unit/content-actions.test.ts:346-401`. Existing selection remains unchanged in assertions: `tests/unit/content-actions.test.ts:378-379`.
- R3 Correct — B3 concurrency repair. Epoch invalidation aborts prior operation; publication checks current epoch; local refresh rereads selector after media scan, retries generation changes; progress/completion/preparation paths reject stale publication/dispose superseded prepared release: `src/shell/application/content-actions.ts:189-220`, `src/shell/application/content-actions.ts:264-298`, `src/shell/application/content-actions.ts:320-356`, `src/shell/application/content-actions.ts:499-614`. Delete-all invalidates prior work, clears selector before bytes, disposes prepared candidate before deletion, leaves failed partial cleanup retryable: `src/shell/application/content-actions.ts:648-686`. Race/disposal/prepared-availability tests: `tests/unit/content-actions.test.ts:403-453`, `tests/unit/content-actions.test.ts:496-560`, `tests/unit/content-actions.test.ts:573-688`.
- R4 Correct — B4 selected media closure. Missing count filters media by `runtime` plus dependency-closed selected chapter packs: `src/shell/application/content-actions.ts:232-262`. Download selector uses same pack predicate: `src/content/storage/progressive-storage-validation.ts:184-194`. Runtime/shared/selected media count reaches zero while other-chapter media stays absent: `tests/unit/content-actions.test.ts:455-494`. Delete-unused retains every active-manifest file identity, not selected subset: `src/content/storage/progressive-content-store.ts:509-541`.
- R5 Correct — B5 native/security evidence. Broadcast handler calls local `refresh()` only; refresh reads selector/jobs/manifest/files, never `fetchLatest`, `cacheManifest`, or `download`: `src/shell/application/application-service.ts:35-48`, `src/shell/application/content-actions.ts:232-298`, `tests/unit/content-actions.test.ts:496-537`. Active domain sessions remain mounted because application notification reacquisition runs only on Main Menu: `src/shell/AppShell.svelte:114-145`. SW identity comes from compiled constants returned by controlling worker: `src/service-worker.ts:42-48`; native test queries `navigator.serviceWorker.controller` via `MessageChannel`: `e2e-core/core-update-consent.spec.ts:35-55`.

## Safety

- S1 Correct — cleanup ownership/locks unchanged safe. Cleanup keeps application-exclusive → download-exclusive nonqueued order, rejects live/running jobs: `src/shell/application/content-actions.ts:358-378`. Delete-all removes only recognized Content cache keys plus four owned stores: `src/content/storage/progressive-content-store.ts:544-565`. Prepared release disposal stays idempotent at refresh/delete/dispose boundaries: `src/shell/application/content-actions.ts:401-423`, `src/shell/application/content-actions.ts:648-684`.
- S2 Blocker — none.
- S3 Fixed — none; review-only contract prohibited source/test edits.

## B1–B5 disposition

- D1 B1: accepted. Byte accumulation bounded to 4096; absent/lying headers cannot bypass body cap; overflow cancels stream.
- D2 B2: accepted. Each discovery failure remains visible; successful channel action plus installed offline selection survive.
- D3 B3: accepted. Epoch/final selector guards cover stale checks, local refresh, download progress/completion, cleanup, prepared disposal/action availability.
- D4 B4: accepted. Missing count equals selected download closure; unselected media excluded; full active manifest retained by delete-unused.
- D5 B5: accepted. Native proof covers all requested domains, real duel, zero optional-media HTTP, cross-tab stale UI clearing, storage preservation, durable approval-before-update, compiled controller A/B identity.

## Native evidence inspected

- N1 Required-only Story, Free Play, Deck Editor, collection, duel recorded with `mediaRequests: []`: `artifacts/T10-REPAIR-EVIDENCE/native-final/media-native-observations.json:2-10`. Duel screenshot shows active Main Phase field/prompt, establishing real WASM duel beyond shell mount: `artifacts/T10-REPAIR-EVIDENCE/native-final/media-duel.png`; fixture builds runtime from frozen WASM/scripts: `e2e-core/content-media-cleanup.spec.ts:47-59`, `e2e-core/content-media-cleanup.spec.ts:238-250`.
- N2 Cross-tab observer loses media/activation controls after delete-all: `e2e-core/content-media-cleanup.spec.ts:252-324`; observation is `canDownloadMedia: false`, `canActivate: false`, `missingMedia: 0`: `artifacts/T10-REPAIR-EVIDENCE/native-final/media-native-observations.json:20-30`.
- N3 Saves/decks hashes match; setting, CORE marker, unknown Content-cache key survive; selector advances to generation 2 with Content null plus Story generation retained: `artifacts/T10-REPAIR-EVIDENCE/native-final/media-native-observations.json:11-29`. Assertions inspect populated Decks DB, Story DB, localStorage, CORE cache bytes, shell caches, unknown cache URL: `e2e-core/content-media-cleanup.spec.ts:266-304`, `e2e-core/content-media-cleanup.spec.ts:326-386`.
- N4 Approval observer waits for readonly IDB transaction completion before invoking original `ServiceWorkerRegistration.prototype.update`: `e2e-core/core-update-consent.spec.ts:111-145`. Recorded row exactly matches B candidate plus selected generation; `approvedAt <= observedAt`: `artifacts/T10-REPAIR-EVIDENCE/native-final/core-native-observations.json:15-31`.
- N5 Controller A survives unapproved cold/offline and remains controller while approved B waits; controller B owns approved cold/offline reopen: `e2e-core/core-update-consent.spec.ts:75-105`, `e2e-core/core-update-consent.spec.ts:137-187`, `artifacts/T10-REPAIR-EVIDENCE/native-final/core-native-observations.json:33-44`. Cache checks are supplemental; identity authority is compiled SW message.

## Validation

- V1 Passed — `npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose` → 3 files, 29/29 tests.
- V2 Passed — `T10_REPAIR_EVIDENCE="$tmp" npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts` → Chromium 2/2. Temp output removed after run.
- V3 Passed — SHA-256 checks for current 27-path inventory, original report, original evidence; `git diff --check`; `git diff --cached --quiet`.
- V4 Inspected — final trace ZIPs contain successful domain navigation/duel/delete assertions plus native registration/update/controller steps: `artifacts/T10-REPAIR-EVIDENCE/native-final/test-results/content-media-cleanup-requ-756ce-eserves-saves-settings-CORE-chromium/trace.zip`, `artifacts/T10-REPAIR-EVIDENCE/native-final/test-results/core-update-consent-CORE-c-7ef2d-nstall-after-all-tabs-close-chromium/trace.zip`. Trace network has required release/WASM traffic, no `story/media/map.png` or `fixture.invalid` media request.
- V5 Corroborated — recorded final Playwright report: expected 2, unexpected 0, flaky 0: `artifacts/T10-REPAIR-EVIDENCE/native-final/playwright-report.json:197-200`. Recorded native regression run: 5/5: `artifacts/T10-REPAIR-EVIDENCE/native-regressions-final.log`.

## Residual risks

- K1 Process deviation only — original strict TDD chronology cannot be retrofixed; D1/P1 remain unchecked: `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T10_update-media-cleanup.md:317`, `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T10_update-media-cleanup.md:337`, `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T10_update-media-cleanup.md:368`. Repair RED→GREEN evidence does not convert original chronology. Not product blocker.
- K2 Deferred prerequisite — T11 locked asset/full-unit-assets gate remains outside B1–B5 acceptance. Native real-WASM fixture depends on existing local frozen scripts/WASM. No acceptance impact while recorded inputs remain available.
- K3 Pre-existing direct cold `#/install-content` readiness issue remains outside B1–B5; Main Menu entry path passed. No regression attributed to repair.

## Assumptions

- A1 Acceptance scope is B1–B5 repair plus preservation checks named in task; no authorization to update ticket/ledger checkbox.
- A2 Local `127.0.0.1` Playwright harness is test execution, not prohibited live/external call.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Concrete B1-B5 dispositions and file:line evidence in R1-R6; no blockers; residual risks K1-K3 documented."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T10-repair.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "3 files passed; 29/29 tests."
    },
    {
      "command": "T10_REPAIR_EVIDENCE=\"$tmp\" npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts",
      "result": "passed",
      "summary": "Chromium 2/2 passed; local temp evidence removed."
    },
    {
      "command": "sha256sum --check repair inventories; git diff --check; git diff --cached --quiet",
      "result": "passed",
      "summary": "Current source/prior evidence hashes valid; diff clean; staging empty."
    },
    {
      "command": "unzip -p native-final trace.zip test.trace/0-trace.network inspection",
      "result": "passed",
      "summary": "Domain, cleanup, approval, controller steps present; no optional fixture media HTTP."
    }
  ],
  "validationOutput": [
    "B1-B5 accepted with no blocker.",
    "Focused Vitest 29/29; native Chromium 2/2.",
    "Native observations show five required-only domains, real duel, zero media requests, preserved saves/decks/settings/CORE/unknown cache key.",
    "Durable approval row observed before original registration.update(); compiled controller identity proves A/A/B lifecycle."
  ],
  "residualRisks": [
    "Original strict TDD chronology D1/P1 remains unmet; process deviation only, not product blocker.",
    "T11 full asset gate remains deferred outside B1-B5.",
    "Pre-existing cold direct installer-route issue remains outside repair scope."
  ],
  "noStagedFiles": true,
  "diffSummary": "Independent read-only acceptance of bounded CORE streaming, split discovery failures, epoch/final-selector concurrency guards, selected-media closure, cache-only cross-tab refresh, cleanup/disposal locks, compiled SW identity, stronger native evidence.",
  "reviewFindings": [
    "no blockers; accepted: B1 bounded stream/cancel",
    "accepted: B2 split failure channels/offline preservation",
    "accepted: B3 epoch/final-selector stale completion guards",
    "accepted: B4 selected media closure",
    "accepted: B5 native all-domain/storage/approval/controller evidence"
  ],
  "manualNotes": "Original TDD chronology remains explicitly unchecked and cannot be retrofixed. Reviewer changed only artifacts/REVIEW-T10-repair.md."
}
```
