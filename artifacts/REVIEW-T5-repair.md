# T5 repair independent concurrency/security review

Status: **done — accepted**. Read-only source review; no correctness blocker found.

## Review

- R1 **Correct · B1 dispositioned.** Content no longer reacquires global `ygo-content-download-v1`; `download()` acquires only nonqueued exclusive per-job mutex `ygo-content-download-job-v1:<jobId>` (`src/content/storage/progressive-content-store.ts:49-50`, `src/content/storage/progressive-content-store.ts:229-248`). This matches Shell-owned global-lock contract (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T9_atomic-activation.md:64-68`). Focused Shell-held-lock test completes without nested acquisition (`tests/unit/progressive-download.test.ts:171-197`); cross-store same-job test rejects `CONTENT_JOB_CONFLICT` while preserving live `running` row (`tests/unit/progressive-download.test.ts:199-247`). Native Chromium confirms both outcomes.
- R2 **Correct · B2 dispositioned.** Strict ownership parser accepts only canonical current-app GET keys with lowercase hash plus valid progressive path (`src/content/storage/progressive-cache-ownership.ts:5-18`). Both cleanup methods enumerate actual Cache keys rather than trusting DB rows (`src/content/storage/progressive-content-store.ts:510-564`); `deleteFilesOutside()` compares against full active-manifest allow-set (`src/content/storage/progressive-content-store.ts:512-524`). Tests cover immediate Cache-before-IDB quota orphan deletion, unknown/noncanonical/legacy preservation, active-manifest orphan retention, partial Cache deletion retry, IDB clear retry (`tests/unit/progressive-storage.test.ts:71-202`, `tests/unit/progressive-download.test.ts:495-540`). Native Cache Storage probe confirms orphan removed, foreign keys retained.
- R3 **Correct · B3 dispositioned.** Post-worker abort check prevents complete transition; second check catches abort during complete-row persistence (`src/content/storage/progressive-content-store.ts:355-380`). Catch persists `paused` before rejecting `CONTENT_CANCELLED` (`src/content/storage/progressive-content-store.ts:369-380`). Four controlled boundary cases cover final Cache/file-row/progress/complete writes (`tests/unit/progressive-download.test.ts:249-325`); native Chromium confirms no complete event plus final paused event.
- R4 **Correct · N1 dispositioned.** Central parser validates exact row/request/progress fields, UUID/key/progress identity, manifest hash, normalized dependency-closed sorted chapters, kind, phase, safe counters, bounds, manifest-derived totals (`src/content/storage/persisted-download-job.ts:16-99`). Resume, list, startup pause paths all use parser (`src/content/storage/progressive-content-store.ts:263-270`, `src/content/storage/progressive-content-store.ts:485-505`, `src/content/storage/progressive-content-store.ts:576-610`). Twenty-two malformed-row cases reject fixed `CONTENT_INTEGRITY_FAILED` on list/open/resume without metadata mutation or network (`tests/unit/progressive-storage.test.ts:204-334`); closure/order cases add direct coverage (`tests/unit/progressive-download.test.ts:327-361`).
- R5 **Correct · repair evidence/current state.** Focused suite passes 91/91; affected Content regressions pass 66/66; typecheck reports 0 errors plus 4 existing warnings. Native Chromium 149 probe passes real Web Locks, Cache Storage, IDB paths. `git diff --check` passes; index has no staged diff. `artifacts/T5-REPAIR-EVIDENCE/repair-source-tests.diff` contains same repair files/hunks inspected in current source; no optional T9/T10 implementation entered repair scope.

## Blockers

- B1 None.

## Residual risks

- K1 T9/T10 production Shell runner/cleanup UI remains unimplemented by scope. Current evidence uses binding T9 lock contract plus equivalent Shell-held-lock harness, not production UI integration (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T9_atomic-activation.md:68`; `artifacts/T5-REPAIR-EVIDENCE/browser-native.mjs:63-86`).
- K2 Cleanup remains intentionally non-atomic across Cache/IDB. Tests prove surfaced failure plus retry, not browser crash/disk-eviction recovery (`src/content/storage/progressive-content-store.ts:510-564`; `tests/unit/progressive-storage.test.ts:148-202`).
- K3 Full repo suite, build, product E2E not run. Review ran focused T5 suite, affected Content regressions, typecheck, native browser harness.

## Files touched

- F1 `artifacts/REVIEW-T5-repair.md` — review deliverable.
- F2 `artifacts/T5-REPAIR-EVIDENCE/browser-native-result.json`, `artifacts/T5-REPAIR-EVIDENCE/browser-native-trace.zip` — native harness refreshed existing evidence. No source edits.

## Assumptions

- A1 T9 lock contract remains binding: Shell owns global exclusive lock; Content owns per-job mutex (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T9_atomic-activation.md:64-68`).
- A2 Current dirty/untracked T5 tree is review target against retained before snapshots, per task/report (`artifacts/IMPLEMENTATION-REPORT-T5-repair.md`).

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1-R5 disposition B1/B2/B3/N1 with exact source/test paths; B1 reports no blockers; K1-K3 record bounded residual risks."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T5-repair.md",
    "artifacts/T5-REPAIR-EVIDENCE/browser-native-result.json",
    "artifacts/T5-REPAIR-EVIDENCE/browser-native-trace.zip"
  ],
  "testsAddedOrUpdated": [
    "tests/unit/progressive-download.test.ts",
    "tests/unit/progressive-storage.test.ts"
  ],
  "commandsRun": [
    {
      "command": "graphify query \"T5 storage repair job parser cache namespace deletion Shell global lock job mutex late cancellation\"",
      "result": "passed",
      "summary": "C1 Graph-first query located T5 storage impl, contracts, tests, plus plan nodes."
    },
    {
      "command": "npx vitest run tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "C2 3 files, 91 tests passed."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "C3 0 errors; 4 existing Svelte warnings."
    },
    {
      "command": "node artifacts/T5-REPAIR-EVIDENCE/browser-native.mjs",
      "result": "passed",
      "summary": "C4 Chromium 149 verified Shell-held lock completion, cross-tab job exclusion, late cancellation, orphan cleanup, offline read."
    },
    {
      "command": "npx vitest run tests/unit/content-installer.test.ts tests/unit/content-storage.test.ts tests/unit/progressive-manifest.test.ts tests/unit/progressive-fixture.test.ts tests/component/content-installer.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "C5 5 files, 66 affected regression tests passed; expected legacy CONTENT_RESPONSE_CANCEL_FAILED stderr occurred inside passing test."
    },
    {
      "command": "git diff --check && git diff --cached --quiet",
      "result": "passed",
      "summary": "C6 Diff whitespace clean; no staged diff."
    }
  ],
  "validationOutput": [
    "V1 Focused T5: 91/91 passed.",
    "V2 Affected Content regressions: 66/66 passed.",
    "V3 Typecheck: 0 errors, 4 existing warnings.",
    "V4 Native browser: underShellLock complete; crossTab CONTENT_JOB_CONFLICT; lateAbort CONTENT_CANCELLED/paused; orphanDeleted true; preserved true.",
    "V5 No staged diff; git diff whitespace check passed."
  ],
  "residualRisks": [
    "K1 T9/T10 production Shell integration remains future scoped work; equivalent native harness used.",
    "K2 Cleanup cross-store operation remains intentionally retryable, not atomic across Cache and IDB.",
    "K3 Full repo suite/build/product E2E not run."
  ],
  "noStagedFiles": true,
  "diffSummary": "Repair removes Content global-lock reacquisition, retains per-job mutex, deletes strict owned cache orphans, closes late-cancel complete race, validates persisted jobs, adds focused unit/native coverage.",
  "reviewFindings": [
    "R1 no blocker: src/content/storage/progressive-content-store.ts:229-248 - B1 fixed; only per-job lock remains.",
    "R2 no blocker: src/content/storage/progressive-content-store.ts:510-564 - B2 fixed; cleanup enumerates strict owned Cache keys plus full allow-set.",
    "R3 no blocker: src/content/storage/progressive-content-store.ts:355-380 - B3 fixed; late abort persists paused and rejects CONTENT_CANCELLED.",
    "R4 no blocker: src/content/storage/persisted-download-job.ts:16-99 - N1 fixed; persisted jobs fail closed under exact validation.",
    "R5 acceptance: no introduced correctness blocker found in reviewed repair."
  ],
  "manualNotes": "M1 Read-only source review. No source edits, subagents, T9/T10 implementation, optional polish, commit, or staging."
}
```
