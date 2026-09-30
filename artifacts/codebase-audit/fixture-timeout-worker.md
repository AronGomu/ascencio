# Selected Content fixture timeout

State: **done, focused checks passed; fresh review pending**. Broad unit rerun incomplete.

## Evidence / root cause

- E1 Original failures: `selected-content-fixture-rerun.log:7` reports `180070ms`; `round-one-unit.log` reports 214 files / 2763 tests passed outside failing fixture. Exact error: `Error: Test timed out in 180000ms.` Original logs preserved.
- E2 Fixture called production `scanAssetProfiles(process.cwd(), ...)`. Scanner traverses **all** asset roots before selection (`scripts/lib/asset-delivery/scan-assets.ts:97`), hashes every file before checking ownership (`:139–160`), traverses corpus again (`:162–165`). Parent safety checks repeat `lstat` / `realpath` for each ancestor (`scripts/lib/asset-delivery/path-guards.ts:124–135`). Appropriate production inventory work; wrong setup scope for selected-payload fixture.
- E3 Local corpus: `find assets -type f | wc -l` → **29743**. `du -sh assets/shared/card-images` → **4.3G**. Real inputs present: prepared metadata holds **14794 runtime card codes**, **1627 chapter card codes**; chapter profile has **3311 file rules**.
- E4 Pre-fix bounded Node probe wrapped real filesystem calls, without stubbing results. At **195s**: **1081403 lstat calls**, **19219 opens**, **2892918608 bytes hashed**; last open still `assets/shared/card-images/full/37120512.jpg`. Deadline **200s**, exit **124**, release not ready. See `fixture-timeout-probe.log`. Failure precedes consolidation / runtime comparison; unrelated asset inventory dominates setup.
- E5 Regression red used original production scanner behind new helper: unrelated dangling symlink → `AssetDeliveryError: ASSET_PATH_UNSAFE`; selected files unchanged. See `fixture-timeout-regression-red.log`. Test detects unwanted traversal deterministically, without perf thresholds / mocks.
- E6 Post-fix focused run: **4 files / 88 tests passed**, **27.69s**. Direct real fixture: **22.223s**, **3769 manifest files**, **458 canonical required files**, **14 consolidated required files**. See `fixture-timeout-focused.log`, `fixture-timeout-node-after.log`.

## Change

- C1 `tests/fixtures/selected-asset-files.ts:13` — enumerate declared selected file/tree rules only; real source digests, safe-path checks, filesystem-kind checks, deterministic ordering retained. No unrelated corpus traversal.
- C2 `tests/fixtures/selected-content-release.ts:27–46` — resolve selected profiles/deps, build validated selected inventory, retain migration guards / frozen vendor verification. Existing prepared metadata parser, manifest derivation, SHA/length assertions, consolidation unchanged (`:47–63`). Production source untouched; original test's `180_000` timeout unchanged.
- C3 `tests/unit/selected-asset-files.test.ts:58–99` — three real-filesystem regressions: selected digests equal production scanner output despite unrelated sentinel; selected-tree symlinks rejected; selected file with wrong filesystem kind rejected. Temp roots uniquely owned, cleaned in `afterEach`.

## Validation

- V1 `timeout --signal=TERM --kill-after=5s 45s npx --no-install vitest run tests/unit/selected-asset-files.test.ts --maxWorkers=1` → expected red: **1 failed / 2 passed** before helper fix.
- V2 `timeout --signal=TERM --kill-after=5s 200s npx --no-install vitest run tests/unit/selected-content-fixture.test.ts tests/unit/selected-asset-files.test.ts --maxWorkers=1` → **4 passed**, **20.70s**. Log: `fixture-timeout-green.log`.
- V3 `timeout --signal=TERM --kill-after=5s 200s npx --no-install vitest run tests/unit/selected-content-fixture.test.ts tests/unit/selected-asset-files.test.ts tests/unit/progressive-release.test.ts tests/unit/battle-runtime-input.test.ts --maxWorkers=1` → **88 passed**, **27.69s**.
- V4 `timeout --signal=TERM --kill-after=5s 70s node --input-type=module -e 'const start = performance.now(); const { selectedContentRelease } = await import("./tests/fixtures/selected-content-release.ts"); const release = await selectedContentRelease(); console.log(JSON.stringify({seconds:(performance.now()-start)/1000,canonicalFiles:release.canonical.manifest.files.length,requiredFiles:release.canonical.bytes.size,consolidatedRequiredFiles:release.consolidated.bytes.size}));'` → **22.223s**, real fixture complete.
- V5 `npx --no-install eslint tests/fixtures/selected-asset-files.ts tests/fixtures/selected-content-release.ts tests/unit/selected-asset-files.test.ts` → passed. Scoped Prettier check → passed after formatting new test. `npx --no-install tsc --noEmit` → passed. `git diff --check` → passed. Evidence: `fixture-timeout-checks.log`.
- V6 Extra `timeout --signal=TERM --kill-after=5s 240s npx --no-install vitest run tests/unit --maxWorkers=1` → **exit 124**, incomplete. Before cutoff, `tests/unit/decks/deck-catalog-performance.test.ts` reported failures: `building fresh indexes stays under budget (best of 20 runs)`; `builds a sorted high-entropy production-shaped index under budget`. No final suite summary. No edits to those tests. See `fixture-timeout-unit-attempt.log`.
- V7 Extra post-fix instrumented Node probe hit **60s** outer deadline; no completion. See `fixture-timeout-probe-after.log`. Subsequent uninstrumented Node execution / focused Vitest succeeded (V3/V4); instrumented timing not acceptance evidence. Initial probe launch with `--import tsx` failed: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'tsx' imported from /home/aron/Projects/ascencio/`. Retried using Node 26 native TypeScript; no install.
- V8 `graphify query "selected-content-fixture.test selectedContentRelease fixture dependencies timeout"` → `/bin/bash: line 1: graphify: command not found`. Used direct source inspection; graph update unavailable.

## Preservation / cleanup

- P1 Baseline `baseline.json` contains **65 dirty entries**. SHA-256 comparison of existing baseline files → `changedBaselineFiles: []` before edits, after tests. `baseline.json`, package files, CI, node-worker harness untouched. No staging / commits.
- P2 `git diff --cached --name-only` → empty; explicit check emitted `Staged files: NONE`.
- P3 Removed owned `.tmp/fixture-timeout-probe.mjs`; new tests' `.tmp/selected-asset-files-*` roots absent after checks. Bounded probe/test process groups terminated. Process inspection found no remaining owned probe / timed-out unit invocation; other sessions' processes preserved.
- P4 Evidence outputs: `fixture-timeout-probe.log`, `fixture-timeout-regression-red.log`, `fixture-timeout-green.log`, `fixture-timeout-probe-after.log`, `fixture-timeout-focused.log`, `fixture-timeout-node-after.log`, `fixture-timeout-unit-attempt.log`, `fixture-timeout-checks.log`, this report — all under `artifacts/codebase-audit/`.

## Assumptions

- A1 Selected fixture tests payload equivalence, not whole-repository asset inventory auditing. Its inventory may omit dev-only files; production scanner remains unchanged. Evidence: test assertions in `tests/unit/selected-content-fixture.test.ts:39–54`; player payload filters inventory by pack ownership in `scripts/lib/asset-delivery/player-payload.ts:27–43`.
- A2 Prepared selected inputs remain stable during fixture setup. Per-file source identity/hash verification remains; fixture no longer provides production scanner's whole-corpus before/after change detection. Fixture already invokes no production inventory lock.

## Residual risks / review gate

- R1 Broad unit suite **not green-confirmed** in this run. Deck perf failures unassessed; contention/cause uncertain. Independent reviewer should rerun focused command V3, inspect fixture scope, then investigate/retry broad suite separately under suitable resource conditions.
- R2 E2E consumer shares `selectedContentRelease` (`e2e/selected-content-fixture.ts:33`); browser E2E not rerun. Real selected-file descriptors/digests preserved by regression; real canonical/consolidated runtime equivalence passed.
- R3 Fresh independent reviewer required before commit. No commit created.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Fixture-only selected inventory fix; production scanner, original 180000ms timeout, baseline user files unchanged. Three real-filesystem regressions; original fixture green."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Original timeout logs, bounded syscall/read-byte probe, regression red, 88 focused tests green, direct fixture completion, scoped static checks, explicit incomplete broad-suite result."
    }
  ],
  "changedFiles": [
    "tests/fixtures/selected-content-release.ts",
    "tests/fixtures/selected-asset-files.ts",
    "tests/unit/selected-asset-files.test.ts",
    "artifacts/codebase-audit/fixture-timeout-worker.md",
    "artifacts/codebase-audit/fixture-timeout-probe.log",
    "artifacts/codebase-audit/fixture-timeout-regression-red.log",
    "artifacts/codebase-audit/fixture-timeout-green.log",
    "artifacts/codebase-audit/fixture-timeout-probe-after.log",
    "artifacts/codebase-audit/fixture-timeout-focused.log",
    "artifacts/codebase-audit/fixture-timeout-node-after.log",
    "artifacts/codebase-audit/fixture-timeout-unit-attempt.log",
    "artifacts/codebase-audit/fixture-timeout-checks.log"
  ],
  "testsAddedOrUpdated": [
    "tests/unit/selected-asset-files.test.ts: three real-filesystem regressions"
  ],
  "commandsRun": [
    {
      "command": "npx --no-install vitest run tests/unit/selected-asset-files.test.ts --maxWorkers=1 (before fix)",
      "result": "failed",
      "summary": "Expected red: ASSET_PATH_UNSAFE from unrelated sentinel; 1 failed, 2 passed."
    },
    {
      "command": "npx --no-install vitest run tests/unit/selected-content-fixture.test.ts tests/unit/selected-asset-files.test.ts tests/unit/progressive-release.test.ts tests/unit/battle-runtime-input.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "4 files, 88 tests passed in 27.69s."
    },
    {
      "command": "npx --no-install tsc --noEmit",
      "result": "passed",
      "summary": "No diagnostics."
    },
    {
      "command": "npx --no-install eslint tests/fixtures/selected-asset-files.ts tests/fixtures/selected-content-release.ts tests/unit/selected-asset-files.test.ts",
      "result": "passed",
      "summary": "Scoped lint clean."
    },
    {
      "command": "npx --no-install prettier --check tests/fixtures/selected-asset-files.ts tests/fixtures/selected-content-release.ts tests/unit/selected-asset-files.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "timeout --signal=TERM --kill-after=5s 240s npx --no-install vitest run tests/unit --maxWorkers=1",
      "result": "failed",
      "summary": "Exit 124; two deck-catalog-performance budget failures observed; no suite summary."
    },
    {
      "command": "git diff --check; git diff --cached --name-only",
      "result": "passed",
      "summary": "No whitespace errors; no staged files."
    }
  ],
  "validationOutput": [
    "Original fixture: Error: Test timed out in 180000ms.",
    "Probe at 195s: 1081403 lstat calls; 2892918608 bytes read; fixture incomplete.",
    "Focused validation: 88 passed; 27.69s.",
    "Direct fixture: 22.223s; 3769 descriptors; 458 canonical required files; 14 consolidated required files.",
    "Baseline preservation: 65 entries; changedBaselineFiles: []."
  ],
  "residualRisks": [
    "Fresh independent review pending before commit.",
    "Broad unit suite incomplete; two deck perf failures unassessed.",
    "Browser E2E not rerun.",
    "Fixture assumes stable prepared inputs; whole-corpus mutation detection remains production-scanner responsibility."
  ],
  "noStagedFiles": true,
  "diffSummary": "Replace whole-corpus production scan in selected-content fixture with selected-rule traversal; preserve real source/vendor/runtime verification; add three filesystem regressions.",
  "reviewFindings": [
    "Fresh reviewer gate pending; worker did not perform independent review."
  ],
  "manualNotes": "No deps, network downloads, config edits, commits, subagents. Owned scratch removed; original logs preserved. Parent must arrange fresh review before commit."
}
```
