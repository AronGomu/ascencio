# Fixture timeout — independent review

State: **done · APPROVED, fixture-only scope**. No blockers. No corrective source edits needed.

## Review

- R1 Correct — selected traversal replaces whole-corpus inventory only inside fixture. `tests/fixtures/selected-content-release.ts:27–46` resolves profiles/deps, validates inventory, retains migration guards/vendor verification. `tests/fixtures/selected-asset-files.ts:18–38` visits selected rules only, hashes real files, retains filesystem-kind checks, sorts descriptors. Production `scripts/lib/asset-delivery/scan-assets.ts` unchanged.
- R2 Correct — assertions NOT weakened/mocked. `tests/unit/selected-content-fixture.test.ts:20–54` unchanged: required-byte SHA/length checks, complete battle input equivalence, runtime/chapter cards, story/media refs, consolidated required-file bound. Original `180_000` timeout unchanged. `tests/fixtures/selected-content-release.ts:47–63` retains manifest derivation, required-source SHA/length checks, consolidation.
- R3 Correct — complete real closure independently checked. Bounded inline Node probe: **3765 selected source files → 3769 descriptors**, **458 canonical required files**, **14 consolidated required files**, **451 runtime asset entries**, **14794 runtime card codes**, **1627 chapter card codes**. Independently enumerated selected file/tree rules; every expected logical/source mapping present. Re-read every descriptor's real/derived bytes; verified SHA/length. Runtime source-manifest hash/file list matched runtime manifest; every declared runtime asset present with matching SHA/length. Canonical card codes exactly matched prepared metadata. Probe passed in **38.115s**.
- R4 Correct — selected-source/runtime verification retained. Real digest helper performs handle/path identity checks, closes handles (`scripts/lib/asset-delivery/source-files.ts:43–108`). Inventory validates selected dependency closure/path collisions (`scripts/lib/asset-delivery/frozen-inventory.ts:37–79`). Vendor scanner checks pinned WASM digest (`scripts/lib/asset-delivery/vendor-files.ts:10–32`). Runtime reader retains frozen executable validation, asset-descriptor closure, card/text/script validation (`src/shell/adapters/progressive-release-data.ts:190–200,226–356`). Focused runtime tests pass.
- R5 Correct — real-filesystem regression catches old traversal. `tests/unit/selected-asset-files.test.ts:58–81` compares selected digests against production scan before adding unrelated dangling symlink; selected loader must still succeed. Symlink/kind rejection tests retained (`:84–99`). Worker red log independently inspected: **1 failed / 2 passed**, exact failure `AssetDeliveryError: ASSET_PATH_UNSAFE`, stack through production `allFiles`. Reviewer independently executed equivalent sentinel check: old production scanner rejected `ASSET_PATH_UNSAFE`; selected loader returned identical real descriptor. No mocks, timing thresholds, source substitutions.
- R6 Correct — **4 files / 88 tests passed**, **126.01s**; tsc/scoped lint/format/whitespace checks passed. Evidence below.
- R7 Correct — baseline **65 dirty entries** preserved: SHA comparison before/after checks returned `changedBaselineFiles: []`. Staged paths empty. Diff for production asset-delivery code, vendor, original selected fixture test empty. No deps/network/config/vendor/user-dirty edits, staging, commits, subagents.
- R8 Correct — no leaked owned test/probe processes observed after checks. `ps` showed unrelated external-project test processes only; preserved. New regression temp roots absent. Reviewer-owned `.tmp/fixture-timeout-review-7v6Drr` inspected, removed in `finally`; worker probe scratch absent.
- R9 Fixed — none. Reviewed worker paths: `tests/fixtures/selected-content-release.ts`, `tests/fixtures/selected-asset-files.ts`, `tests/unit/selected-asset-files.test.ts`. Reviewer deliverable only: this report.
- R10 Blocker — none within assigned scope.

## Validation

- V1 `timeout --signal=TERM --kill-after=5s 200s npx --no-install vitest run tests/unit/selected-content-fixture.test.ts tests/unit/selected-asset-files.test.ts tests/unit/progressive-release.test.ts tests/unit/battle-runtime-input.test.ts --maxWorkers=1` → exit 0; `Test Files  4 passed (4)`; `Tests  88 passed (88)`; `Duration  126.01s` (tests 111.18s).
- V2 `timeout --signal=TERM --kill-after=5s 120s npx --no-install tsc --noEmit` → exit 0, no diagnostics.
- V3 `timeout --signal=TERM --kill-after=5s 60s npx --no-install eslint tests/fixtures/selected-asset-files.ts tests/fixtures/selected-content-release.ts tests/unit/selected-asset-files.test.ts` → exit 0, no diagnostics.
- V4 `timeout --signal=TERM --kill-after=5s 60s npx --no-install prettier --check tests/fixtures/selected-asset-files.ts tests/fixtures/selected-content-release.ts tests/unit/selected-asset-files.test.ts` → exit 0; `All matched files use Prettier code style!`
- V5 `timeout --signal=TERM --kill-after=5s 200s node --input-type=module` with inline real-fixture/descriptor/closure assertions → exit 0. Output: `{"seconds":38.115360110999994,"selectedProfiles":["chapter-01","core","runtime"],"expectedSelectedSourceFiles":3765,"descriptors":3769,"canonicalRequiredFiles":458,"consolidatedRequiredFiles":14,"runtimeAssetClosure":451,"runtimeCardCodes":14794,"chapterCardCodes":1627,"allDescriptorDigestsVerified":true,"runtimeSourceManifestVerified":true}`.
- V6 `timeout --signal=TERM --kill-after=5s 45s node --input-type=module` with inline owned-temp real-filesystem sentinel assertions → exit 0. Output: `Old production scan: ASSET_PATH_UNSAFE; selected loader: identical real descriptor; no mocks.` Temp cleanup completed.
- V7 Inline Node SHA-256 comparison against `artifacts/codebase-audit/baseline.json` → `{"baselineEntries":65,"changedBaselineFiles":[]}` before/after validation. `git diff --check` → exit 0. `git diff --cached --name-only` → empty. `git diff --name-only -- scripts/lib/asset-delivery vendor tests/unit/selected-content-fixture.test.ts` → empty.
- V8 `graphify query "selected content fixture selected profile manifest runtime asset scan"` → exit 127; `/bin/bash: line 1: graphify: command not found`. Direct source inspection used. Runtime: `node --version` → `v26.7.0`.

## Assumptions

- A1 Fixture exercises selected payload equivalence, not whole-repo inventory auditing. Justified by unchanged semantic assertions (`tests/unit/selected-content-fixture.test.ts:39–54`) plus production payload's profile filter (`scripts/lib/asset-delivery/player-payload.ts:28–35`). Core assets remain loaded by selected helper; progressive payload intentionally excludes core pack.
- A2 Prepared inputs stable during fixture execution. Per-file read identity verification retained; whole-scan before/after inventory/profile revalidation intentionally absent from fixture path. Production scanner retains those checks (`scripts/lib/asset-delivery/scan-assets.ts:162–176`).

## Residual risks

- N1 Note · medium perf variability — worker reported 27.69s focused / 22.223s direct; reviewer observed **126.01s focused / 38.115s direct**. No timeout failure in reviewer run; ~22s performance not reproduced. Other project processes observed; contention causality unproven. Fix removes unrelated corpus scaling, not selected-corpus cost or host-load sensitivity. Follow-up: isolated host rerun before treating elapsed time as perf baseline.
- N2 Note · coverage — broad unit suite intentionally NOT rerun. Worker reports prior 240s cutoff plus two deck perf budget failures (`artifacts/codebase-audit/fixture-timeout-worker.md`, V6). Those failures remain unassessed; this approval does not certify whole suite. Follow-up: investigate deck perf separately, avoid mixed broad/perf rerun here.
- N3 Note · coverage — browser E2E consumer not rerun (`e2e/selected-content-fixture.ts:33`). Node fixture/runtime equivalence passed; browser behavior remains separate acceptance gate.
- N4 Note · scope — production scanner still hashes whole corpus; unchanged intentionally. Fixture no longer audits unselected media, whole-corpus mutations, archive-wide limits. Selected missing inputs retain existing omission semantics (`tests/fixtures/selected-asset-files.ts:21–22` versus production scanner diagnostics at `scripts/lib/asset-delivery/scan-assets.ts:109–120`); actual checked snapshot closure complete per R3.

Next action: accept fixture-only fix; retain N1–N3 as separate validation follow-ups. No further source writes from reviewer.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1–R10 cite reviewed paths/lines; no blockers. Independent 88-test pass, real descriptor/14794-card closure verification, old-scanner sentinel rejection. N1–N4 record residual risks."
    }
  ],
  "changedFiles": [
    "artifacts/codebase-audit/fixture-timeout-review.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "timeout --signal=TERM --kill-after=5s 200s npx --no-install vitest run tests/unit/selected-content-fixture.test.ts tests/unit/selected-asset-files.test.ts tests/unit/progressive-release.test.ts tests/unit/battle-runtime-input.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "4 files; 88 tests; 126.01s."
    },
    {
      "command": "timeout --signal=TERM --kill-after=5s 120s npx --no-install tsc --noEmit",
      "result": "passed",
      "summary": "No diagnostics."
    },
    {
      "command": "timeout --signal=TERM --kill-after=5s 60s npx --no-install eslint tests/fixtures/selected-asset-files.ts tests/fixtures/selected-content-release.ts tests/unit/selected-asset-files.test.ts",
      "result": "passed",
      "summary": "Scoped lint clean."
    },
    {
      "command": "timeout --signal=TERM --kill-after=5s 60s npx --no-install prettier --check tests/fixtures/selected-asset-files.ts tests/fixtures/selected-content-release.ts tests/unit/selected-asset-files.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "timeout --signal=TERM --kill-after=5s 200s node --input-type=module",
      "result": "passed",
      "summary": "Inline real-fixture probe: all 3769 descriptor digests verified; 458 required files; 451 runtime asset entries; exact 14794 prepared card codes; 38.115s."
    },
    {
      "command": "timeout --signal=TERM --kill-after=5s 45s node --input-type=module",
      "result": "passed",
      "summary": "Inline filesystem regression: old scan rejects unselected sentinel ASSET_PATH_UNSAFE; new selected loader preserves real descriptor. Owned temp removed."
    },
    {
      "command": "git diff --check; git diff --cached --name-only",
      "result": "passed",
      "summary": "Whitespace clean; staged paths empty. Baseline hash probe separately confirmed 65 entries unchanged."
    },
    {
      "command": "graphify query \"selected content fixture selected profile manifest runtime asset scan\"",
      "result": "failed",
      "summary": "/bin/bash: line 1: graphify: command not found; source inspection fallback."
    }
  ],
  "validationOutput": [
    "4 files / 88 tests passed; 126.01s.",
    "3769 real descriptors; 458 canonical required files; 14 consolidated required files.",
    "451 runtime asset entries verified; 14794 canonical cards match prepared metadata; 1627 chapter cards.",
    "Baseline65 preserved; changedBaselineFiles: []; staged paths empty.",
    "No owned process/scratch remnants observed."
  ],
  "residualRisks": [
    "N1 medium: elapsed time load-sensitive; worker ~22s direct timing not reproduced, reviewer direct 38.115s / focused 126.01s.",
    "N2 coverage: broad unit suite not rerun; prior deck perf failures unresolved.",
    "N3 coverage: browser E2E not rerun.",
    "N4 scope: fixture assumes stable prepared inputs; whole-corpus inventory auditing remains production-scanner responsibility."
  ],
  "noStagedFiles": true,
  "diffSummary": "Approve three worker fixture/regression paths unchanged. Reviewer added report only; no corrective source edits.",
  "reviewFindings": [
    "R1–R5: selected traversal preserves real source descriptors, hashes, runtime closure, original assertions; regression catches old whole-corpus traversal.",
    "R6–R8: focused/static checks pass; baseline65 preserved; no owned process leaks observed.",
    "R10: no blockers within fixture-only scope."
  ],
  "manualNotes": "APPROVED fixture-only scope. No broad suite, timeout bumps, deps/network/config/vendor/user-dirty edits, staging, commits, subagents. Separate isolated perf/browser validation remains. End state: no further writes."
}
```
