Fix B1 first: remove Content-level `ygo-content-download-v1` reacquisition before T9 runner lands.

# T5 independent security/concurrency review

Status: **blocked**. Baseline: `5c2ddff`. Review read-only; no source edits.

## Review

- R1 **Correct · contract/integrity.** Cache reuse requires DB file row, exact key metadata, bounded body, exact byte count, SHA-256 match (`src/content/storage/progressive-content-store.ts:179-192`). Cache write precedes DB file row (`src/content/storage/progressive-content-store.ts:327-342`) → interrupted body never gains reuse receipt. `sealRequired` rereads every dependency-closed required file before receipt write (`src/content/storage/progressive-content-store.ts:411-435`); `verifyRequired` rechecks manifest sequence, normalized closure, receipt identity, receipt contents, cached bytes (`src/content/storage/progressive-content-store.ts:439-477`). Focused tests passed 55/55.
- R2 **Correct · offline/freshness/resume.** `readFile` uses cached manifest/file paths only (`src/content/storage/progressive-content-store.ts:195-212`); null endpoint affects fetch path, not reads. Persisted request retains manifest hash; normalization closes/sorts chapters (`src/content/storage/progressive-storage-validation.ts:159-214`). Required selection excludes media (`src/content/storage/progressive-storage-validation.ts:184-194`). Existing tests cover advanced latest pointer, exact resume mismatch, version reuse, zero media GET, four-file concurrency (`tests/unit/progressive-download.test.ts:167-455`).
- R3 **Correct · scope/API.** Parent-approved aliases preserve legacy consumers while exact T5 names occupy public API (`src/content/index.ts:36-37`, `src/content/index.ts:72`, `src/content/index.ts:90-100`; `src/shell/screens/InstallContentScreen.svelte:14`). Boundary test plus actual scan passed; progressive Content adds no semantic domain import (`tests/unit/domain-boundaries.test.ts:915-931`).

- B1 **Blocker · Critical · nested Web Lock deadlock.** `download()` acquires shared `ygo-content-download-v1` (`src/content/storage/progressive-content-store.ts:228-252`). Binding T9 contract says Shell download runner already holds exclusive same lock throughout work (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T9_atomic-activation.md:68`). Web Locks lack reentrancy: Chromium probe returned `blocked-under-exclusive` when exclusive owner requested nested shared lock. T9 runner awaiting `store.download()` → outer exclusive waits on callback → inner shared waits on outer release. Minimal fix: remove global download-lock acquisition/constant from Content; retain exact per-job lock. Shell owns global lock. Add integration test wrapping `store.download()` in Shell-held exclusive lock, asserting bounded completion. Add cross-store same-job test for exact job lock.
- B2 **Blocker · High · cleanup misses owned crash-orphan cache bodies.** Download writes Cache before DB row (`src/content/storage/progressive-content-store.ts:327-342`). Quota fixture proves body can exist without row (`tests/unit/progressive-storage.test.ts:226-250`). Both cleanup methods enumerate DB `files` rows only (`src/content/storage/progressive-content-store.ts:491-520`); neither calls `cache.keys()`. Immediate Delete all after that fault leaves owned downloaded bytes behind, contradicting T5 cleanup closure plus T10 “downloads removed” contract (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T10_update-media-cleanup.md:76`). Current test resumes before cleanup, hiding orphan (`tests/unit/progressive-storage.test.ts:252-260`). Minimal fix: enumerate cache keys; delete only keys matching strict progressive-owned namespace/provenance. For `deleteFilesOutside`, compare canonical owned keys against full active-manifest allow-set. Preserve nonmatching unknown keys. Tests: quota fault → immediate `deleteAllDownloaded()` removes `failedPutKey`; unknown key remains. Strict owned orphan outside active allow-set → `deleteFilesOutside()` removes it.
- B3 **Blocker · High · late cancellation can commit `complete`.** Abort checked only before each file (`src/content/storage/progressive-content-store.ts:310-316`). Abort during final `cache.put`, file-row write, or progress persistence does not stop those awaits (`src/content/storage/progressive-content-store.ts:327-344`). Final worker then sees no next file, returns before another abort check; code writes `phase: "complete"` (`src/content/storage/progressive-content-store.ts:354-364`). Violates explicit cancellation → persisted `paused` (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T5_progressive-storage.md:23`). Minimal fix: `throwIfAborted(runSignal)` after workers/persistence, before complete transition. Test delays final Cache/DB write, aborts while pending, then expects `CONTENT_CANCELLED` plus persisted `paused`.
- N1 **Note · Medium · persisted jobs lack integrity validation.** `listJobs()` sorts/freezes raw IDB values (`src/content/storage/progressive-content-store.ts:481-486`); `immutableJob` only clones/freezes (`src/content/storage/progressive-storage-validation.ts:217-221`). `pauseInterruptedJobs` also dereferences raw rows (`src/content/storage/progressive-content-store.ts:543-557`). Malformed local metadata can escape as non-UUID/non-normalized progress or brick open with generic storage failure, violating normalized immutable job contract (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T5_progressive-storage.md:90`). Minimal fix: central persisted-job parser validating exact shape, UUID identity, request closure/order, phase, safe counters, bounds, `progress.jobId === request.jobId`; reject corrupt row with fixed Content error. Add malformed-row list/open tests.

## Tests

- T1 `npx vitest run tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose` → passed, 3 files/55 tests.
- T2 `npm run typecheck` → passed, 0 errors; 4 pre-existing Svelte warnings.
- T3 `npx vitest run tests/unit/content-installer.test.ts tests/unit/content-storage.test.ts tests/unit/progressive-manifest.test.ts tests/unit/progressive-fixture.test.ts tests/component/content-installer.test.ts --reporter=verbose` → passed, 5 files/66 tests. Existing `CONTENT_RESPONSE_CANCEL_FAILED` stderr occurred inside passing legacy test.
- T4 Chromium Web Locks probe → passed diagnostic; output `blocked-under-exclusive`. `TestLockManager` shared/shared probe output `Error: Test lock wait not supported` → fixture ignores lock modes (`tests/fixtures/progressive-storage.ts:40-64`) and cannot model browser shared-lock concurrency.
- T5 `git diff --check` plus `git diff --cached --quiet` → passed; no staged files.

## Residual risks

- K1 Real Chromium Cache Storage behavior remains untested; only Web Lock semantics received browser probe.
- K2 Full repo suite/E2E not run; focused T5 plus affected Content regressions passed.
- K3 T9/T10 Shell runner/cleanup UI not implemented yet; B1 integration test requires that runner or equivalent harness.
- K4 Cleanup Cache-before-IDB ordering permits truthful partial failure by design; fixed impl still needs retry tests for Cache delete or IDB clear failure.

## Files touched

- F1 `artifacts/REVIEW-T5.md` only.

## Assumptions

- A1 T9 lock contract is binding integration contract for T5, per task steering.
- A2 Working tree diff plus untracked T5 files constitutes implementation under review against `5c2ddff`.

Next action: implement B1 plus lock integration test; rerun focused 55-test command.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "B1-B3 give concrete blocker severities, paths, line evidence, minimal fixes, and tests; N1 plus K1-K4 record follow-up and residual risks."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T5.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"T5 progressive storage content module architecture files related tests boundaries\"",
      "result": "passed",
      "summary": "Graph-first T5 context located implementation, contracts, and tests."
    },
    {
      "command": "npx vitest run tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "3 files, 55 tests passed."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "0 errors; 4 pre-existing warnings."
    },
    {
      "command": "npx vitest run tests/unit/content-installer.test.ts tests/unit/content-storage.test.ts tests/unit/progressive-manifest.test.ts tests/unit/progressive-fixture.test.ts tests/component/content-installer.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "5 files, 66 affected Content regression tests passed."
    },
    {
      "command": "Chromium nested Web Lock probe; TestLockManager shared/shared probe; git diff --check; git diff --cached --quiet",
      "result": "passed",
      "summary": "Chromium reported blocked-under-exclusive; fixture reported Test lock wait not supported; diff clean; no staged files."
    }
  ],
  "validationOutput": [
    "V1 Focused T5 suite: 55/55 passed.",
    "V2 Affected Content regressions: 66/66 passed.",
    "V3 Typecheck: 0 errors, 4 pre-existing warnings.",
    "V4 Chromium: nested shared request remained blocked under caller-held exclusive lock.",
    "V5 No staged files; git diff whitespace check passed."
  ],
  "residualRisks": [
    "K1 Real Chromium Cache Storage path untested.",
    "K2 Full repo suite and E2E not run.",
    "K3 T9/T10 integration not present, so fixed Shell lock ownership remains to prove.",
    "K4 Cleanup partial-failure retry behavior needs fault-injection coverage."
  ],
  "noStagedFiles": true,
  "diffSummary": "T5 adds progressive Content contracts, path+version Cache/IDB staging, resumable jobs, offline reads, sealing/verification, cleanup, public exports, alias migration, and focused tests; review found three blocking concurrency/cleanup/cancellation defects.",
  "reviewFindings": [
    "B1 blocker critical: src/content/storage/progressive-content-store.ts:228-252 - Content reacquires shared ygo-content-download-v1 under future Shell-held exclusive lock, causing nested deadlock.",
    "B2 blocker high: src/content/storage/progressive-content-store.ts:491-520 - cleanup enumerates DB rows only, leaving owned Cache.put-before-IDB crash orphans.",
    "B3 blocker high: src/content/storage/progressive-content-store.ts:310-364 - abort during final persistence can still commit complete instead of paused.",
    "N1 note medium: src/content/storage/progressive-content-store.ts:481-486 - listJobs exposes unvalidated persisted rows rather than guaranteed normalized immutable jobs."
  ],
  "manualNotes": "Review-only. No source files edited; parent-approved legacy aliases accepted."
}
```
