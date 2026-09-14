Accept T7 repair. Reviewed scope clean; no blocker.

**State:** `done` · prior runtime B1–B4 plus integration measurement B1 dispositioned.

## Review

### Correct

- C1. Runtime B1 fixed: Worker parses/validates input, computes SHA-256, compares frozen `7415337a6f88653b38e10faa3a087c0a5ab64dd27a7d7cf8a1e6872747c5c265`, then enters engine stage (`src/battle/worker/create-browser-runtime.ts:38-61`). `sha256sum vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm` returns same digest; manifest pins same value (`vendor/ocgcore-wasm/0.1.2/vendor-manifest.json:99-101`). Mutant regression asserts zero `OcgCoreAdapter.initialize` calls plus `snapshot_validation_failed`/no ready (`tests/integration/installed-runtime-wasm.test.ts:34-57`).
- C2. Runtime B4 fixed: actual `adapter.getVersion()` comparison remains inside `runDuelRuntimeInitializationStage("engine_initialization_failed", ...)` (`src/battle/worker/create-browser-runtime.ts:57-81`). Real-WASM mismatch regression asserts exact code, non-recoverable status, no ready (`tests/integration/installed-runtime-wasm.test.ts:60-87`).
- C3. Runtime B2 fixed: `disposed` resolves first; parsed/malformed events stop during shutdown (`src/battle/app/DuelWorkerClient.ts:439-469`). `#failWorker` suppresses `error`/`messageerror`/`exit` effects (`src/battle/app/DuelWorkerClient.ts:568-580`); `#disposalResolver` exists before `postMessage` → synchronous callbacks covered (`src/battle/app/DuelWorkerClient.ts:599-631`). Regressions cover replace, dispose, simultaneous replace/dispose, synchronous delivery, clean replacement (`tests/unit/duel-worker-client.test.ts:464-535`).
- C4. Runtime B3 fixed exactly: public interface shape lives at `src/battle/ports/battle-runtime-source.ts:67-70`, exports through `src/battle/ports/index.ts:5-10`, internal union reuses it at `src/battle/duel/contracts/duel-command.ts:1-27`. Export inventory plus type equality bind API (`tests/unit/domain-boundaries.test.ts:1099-1111`, `tests/unit/battle-runtime-input.test.ts:67-75`).
- C5. Integration B1 fixed: benchmark exports immutable `86631c98f616efc49ecf61e5a3e259c6130bd404` via `git archive` (`artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs:281-293`), uses five fresh alternating processes/lane (`artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs:294-330`), times same `DuelWorkerClient.initialize`→ready interval including semantic `source.load` (`artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs:203-235`), samples main+Worker heap by same method (`artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs:149-164,333-375`). Warm-reader/storage/5 ms sampling/browser limits declared (`artifacts/T7-REPAIR-EVIDENCE/measurement-summary.json:3-7`). Inputs match: 2,136 files, digest `e0dfb22860bf5b1f724547db5bd2e02cdc69e4b76409c47ceb1b188c0d5ffd1d`; startup ratio `0.762`, heap ratio `0.768`, both within `1.2` (`artifacts/T7-REPAIR-EVIDENCE/measurement-summary.json:8-21,36`).

### Fixed

- F1. Reviewer applied no source/test fix. Review artifact only: `artifacts/REVIEW-T7-repair.md`.

### Blocker

- B1. None.

### Note

- N1. Independent rerun passed 4 files, 87/87 tests. Expected stderr confirms mutant `snapshot_validation_failed` plus ABI mismatch `engine_initialization_failed`; command exit `0`.
- N2. Benchmark not rerun because retained script/raw runs/summary are internally reproducible plus exact repair tests passed; running it rewrites evidence files. Existing attestation clearly limits claim to warm Node runtime transport, not cold Chromium/cache latency (`artifacts/IMPLEMENTATION-REPORT-T7-repair.md:34-39`).

## Assumptions

- A1. Requested baseline means commit `86631c9`; resolved immutable SHA matches benchmark: `86631c98f616efc49ecf61e5a3e259c6130bd404` (`git rev-parse 86631c9^{commit}`).
- A2. Review scope limited to named T7 repair source/tests/reports/evidence. Existing unrelated dirty files excluded.

## Residual risks

- R1. None in reviewed acceptance scope. Warm-reader benchmark limits are declared measurement boundaries, not hidden product claims (`artifacts/T7-REPAIR-EVIDENCE/measurement-summary.json:5-7`).

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "C1-C5 disposition runtime B1-B4 plus integration B1 with source/test/benchmark paths; B1 reports no blocker; R1 records no in-scope residual risk."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T7-repair.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"T7 runtime repair frozen hash typed ABI shutdown disposal benchmark InitializeRuntimeCommand\"",
      "result": "passed",
      "summary": "Repository graph queried before source inspection."
    },
    {
      "command": "npx vitest run tests/unit/battle-runtime-input.test.ts tests/unit/domain-boundaries.test.ts tests/unit/duel-worker-client.test.ts tests/integration/installed-runtime-wasm.test.ts --reporter=dot",
      "result": "passed",
      "summary": "4 files, 87 tests passed in 3.71s."
    },
    {
      "command": "sha256sum vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm && git diff --exit-code 86631c9 -- vendor && git rev-parse 86631c9^{commit}",
      "result": "passed",
      "summary": "WASM digest matches frozen manifest; vendor diff empty; baseline resolved to full immutable SHA."
    },
    {
      "command": "git diff --check 86631c9 -- src/battle/app/DuelWorkerClient.ts src/battle/worker/create-browser-runtime.ts src/battle/ports/battle-runtime-source.ts src/battle/ports/index.ts src/battle/duel/contracts/duel-command.ts tests/integration/installed-runtime-wasm.test.ts tests/unit/duel-worker-client.test.ts tests/unit/battle-runtime-input.test.ts tests/unit/domain-boundaries.test.ts e2e-content/t7-runtime.spec.ts",
      "result": "passed",
      "summary": "No whitespace defects in reviewed source/test set."
    },
    {
      "command": "git diff --cached --quiet",
      "result": "passed",
      "summary": "No staged files before report write."
    }
  ],
  "validationOutput": [
    "V1. Frozen WASM SHA-256: 7415337a6f88653b38e10faa3a087c0a5ab64dd27a7d7cf8a1e6872747c5c265.",
    "V2. Focused repair suite: Test Files 4 passed; Tests 87 passed.",
    "V3. Benchmark summary: startup ratio 0.761861256500743; sampled combined heap ratio 0.7681208813476419; budgetSatisfied true.",
    "V4. Baseline SHA: 86631c98f616efc49ecf61e5a3e259c6130bd404; vendor diff empty; staging empty."
  ],
  "residualRisks": [
    "R1. None in reviewed scope; benchmark explicitly attests warm Node runtime transport only."
  ],
  "noStagedFiles": true,
  "diffSummary": "Read-only acceptance review of T7 repair. No source/test edits; report artifact added.",
  "reviewFindings": [
    "C1. clean: src/battle/worker/create-browser-runtime.ts:38-81 - frozen hash precedes engine initialization; actual ABI mismatch preserves engine_initialization_failed.",
    "C2. clean: src/battle/app/DuelWorkerClient.ts:439-469,568-631 - stale shutdown events/errors suppressed across synchronous and async disposal races.",
    "C3. clean: src/battle/ports/battle-runtime-source.ts:67-70 - exact public InitializeRuntimeCommand exported and reused internally.",
    "C4. clean: artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs:149-164,203-235,281-375 - reproducible immutable-baseline, source.load-inclusive, symmetric startup/heap benchmark with declared warm-reader limits.",
    "B1. no blockers."
  ],
  "manualNotes": "All previous runtime B1-B4 and integration B1 findings dispositioned. No optional polish findings."
}
```
