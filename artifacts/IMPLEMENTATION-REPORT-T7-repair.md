# T7 retry1 — checked repair, review pending

**Next:** reviewer inspect `artifacts/T7-REPAIR-EVIDENCE/commands.json` plus named regressions. Parent accepts; this report does not self-accept.

**State:** done · runtime B1–B4 repaired · integration measurement B1 replaced · prior malformed acceptance JSON/performance claim superseded. Initial reports, reviews, worktrees, evidence retained.

## Repairs

- R1. Frozen WASM identity enforced inside Worker before `OcgCoreAdapter.initialize`: `src/battle/worker/create-browser-runtime.ts:20-55`. SHA-256 equals `vendor/ocgcore-wasm/0.1.2/vendor-manifest.json:99-101` plus actual binary: `7415337a6f88653b38e10faa3a087c0a5ab64dd27a7d7cf8a1e6872747c5c265`. One-byte mutant yields `snapshot_validation_failed`, zero engine initialize calls, no ready. `tests/integration/installed-runtime-wasm.test.ts:34`; native Chromium mutant also rejected.
- R2. Shutdown suppresses parsed events, malformed events, error/messageerror/exit callbacks; `disposed` still resolves graceful shutdown. Resolver guard covers synchronous callbacks before shutdown Promise assignment. `src/battle/app/DuelWorkerClient.ts:439-469,568-580`; tests at `tests/unit/duel-worker-client.test.ts:465,506,523` cover replace, dispose, simultaneous replace/dispose, synchronous post; store/listeners unchanged. Replacement initializes normally; racing dispose spawns no replacement.
- R3. Exact `InitializeRuntimeCommand` defined in `src/battle/ports/battle-runtime-source.ts:67`; exported by `src/battle/ports/index.ts`; internal command union imports same interface. No speculative root-entry expansion. Exact export freeze: `tests/unit/domain-boundaries.test.ts:1099`; compile-time exact shape/union equality: `tests/unit/battle-runtime-input.test.ts:67`.
- R4. Real engine initialize executes; post-init `getVersion()` comparison stays inside typed stage. Mismatch preserves `engine_initialization_failed`, emits no ready: `src/battle/worker/create-browser-runtime.ts:57-81`; regression `tests/integration/installed-runtime-wasm.test.ts:60` overrides adapter-reported version after real frozen WASM initialization, not DTO declaration.
- R5. Rerunnable same-interval measurement includes Shell source assembly, client validation/clone/transfer, Worker validation/hash/engine/dependencies, client-observed ready. Script: `artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs`. Immutable baseline `86631c98f616efc49ecf61e5a3e259c6130bd404` exported via `git archive` into private `mkdtemp` directory; no checkout/worktree/history mutation. Script removes only own scratch.

## Measurement — replacement evidence, not previous claim

Command, repo root:

```sh
node --expose-gc artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs
```

Evidence: `benchmark-attempt2.log`, exit `0`; `measurement-summary.json`; ten raw `measurement-{1..5}-{baseline,semantic}.json` files. Five fresh Node processes/lane, alternating order. Both use identical 2136 installed files; SHA-256 aggregate `e0dfb22860bf5b1f724547db5bd2e02cdc69e4b76409c47ceb1b188c0d5ffd1d`. Frozen real WASM reports `[11,0]` in both lanes.

| Metric · median | Baseline | Semantic | Change |
| --- | ---: | ---: | ---: |
| M1 · client init → ready | 546.72 ms | 416.52 ms | −23.81% |
| M2 · combined sampled heap high-water | 191,753,256 B | 147,289,680 B | −23.19% |
| M3 · combined heap at ready | 191,753,256 B | 126,441,992 B | −34.06% |
| M4 · sampled proc RSS high-water | 1,438,117,888 B | 1,215,356,928 B | −15.49% |

**Budget:** same-method startup/combined sampled heap ratios `0.762` / `0.768`, both ≤ `1.2`. No >20% regression → no DTO optimization needed. Shell source.load alone takes 162.80–177.89 ms, fully inside M1; original Worker-only comparison omitted this work.

## Assumptions / limits

- A1. Homologous interval starts at `DuelWorkerClient.initialize` in both lanes; old API takes Content ref, new API invokes Shell source.load. Shell gameplay already loaded in both; old Worker still performs its production reload/receipt/runtime validation. Common content installation/activation plus module/Worker boot excluded in both. Benchmark is runtime startup, not app navigation-to-first-pixel.
- A2. Identical warm in-memory installed reader/storage in both isolates; real Blob bytes, no req/fs/IDB/CacheStorage reads during interval. Fixture extraction/input validation happen before timing. This isolates runtime transport, not real storage-device latency; no synthetic replacement engine.
- A3. Main + Worker `heapUsed` summed; 5ms timer samples plus source/IPC/progress boundaries. Worker threads share OS proc → RSS counted once. External/ArrayBuffer fields retained separately, never added together or relabeled JS heap. Coordinator runs outside measured proc. Synchronous allocations can hide short peaks; M2 is sampled high-water, not exact allocation peak.
- A4. Node measurement does not attest Chromium-wide multi-process heap, PWA cold startup, or actual cache latency. Native Chromium evidence separately proves real Worker/WASM ready → prompt → surrender, transfer detachment, mutant rejection. Browser attachment names `workerInitializationMs` separately from `sourceLoadMs`; renderer heap remains main-only, unused for M2.
- A5. Parent route supplied: failed Sol-high acceptance → `openai-codex/gpt-6-astra:high`, retry1 per N3. No metadata question, child delegation, commit, staging, push, deploy, vendor edit, T8 work, optional polish.

## Validation

Exact commands, exit codes, log filenames: `artifacts/T7-REPAIR-EVIDENCE/commands.json`.

| Evidence | Result |
| --- | --- |
| V1 · `red-vitest.log` | Expected exit 1; 7 failed / 80 passed. Actual mutant/version/race/export defects fail before impl. Compile-only type equality not claimed as runtime RED. |
| V2 · `green-vitest.log` | Exit 0; 87/87 passed. |
| V3 · `exact-vitest.log` | Exact ticket cmd exit 0; 5 files, 65/65 passed. |
| V4 · `affected-vitest.log` | Client/runtime/attachment/store/replay/Node Worker/facade/components exit 0; 16 files, 202/202 passed. |
| V5 · `chromium.log`, `playwright-report.json`, `browser-results/` | Exit 0; 1/1 passed in 9.4s. Frozen engine succeeds, transferred sender buffer detached; mutant yields snapshot_validation_failed/no ready. Prior browser evidence untouched. |
| V6 · `typecheck.log` | Exit 0; 0 errors, 4 existing Svelte warnings. |
| V7 · `vendor-verify.log`, `vendor-hashes.log`, `vendor-diff.log` | Exit 0; ocgcore-wasm 0.1.2, 21 files; vendor pin/source checked, vendor diff empty. |
| V8 · `scoped-quality.log` | Exit 0; 10 repair code files; explicit-root ESLint 0 errors/warnings, Prettier clean. |
| V9 · `preservation.json`, `diff-check.log`, `staging.exit` | 2239 pre-existing files unchanged, 11 intentional changes, no unexpected mutation/deletion; diff check passed, staging empty. Benchmark scratch removed. |

## Failures / skipped checks

- F1. Benchmark harness attempt1 failed `ERR_WORKER_PATH`: Worker ctor received file URL string. Bounded harness repair wraps `new URL(import.meta.url)`; attempt2 exit 0. Initial failing log retained; no product change for harness error. Preservation harness attempt1 also falsely classified already-deleted tracked paths/directory symlink as new files; matching original regular-file inventory fixed it. `preservation-attempt2.log` exit 0; first log retained.
- F2. Full lint skipped per task. Existing failure: `No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present`. Scoped explicit-root check passes; not claimed full lint pass.
- F3. Old installer browser path skipped per task: unrelated cropped-art `CONTENT_INVALID_MANIFEST` / `ASSET_INTEGRITY_FAILED`. No bundle/art rewrite. Runtime Chromium path passes independently.
- F4. `graphify . --update` skipped per task: existing Gemini `429 RESOURCE_EXHAUSTED`. No external updater retry. Local graph query used before source inspection; graph remains stale for this repair.
- F5. Required independent reviewer gate remains open. No remaining known runtime B1–B4 defect or measured >20% regression; A1–A4 measurement limits remain explicit. Deliberate shutdown-only early returns suppress stale callbacks; no added `|| true`, empty catch, unobserved rejecting Promise, or req fallback in product code.

## Changed paths

Exact code inventory: `artifacts/T7-REPAIR-EVIDENCE/repair-code-files.json`. Preservation inventory: `artifacts/T7-REPAIR-EVIDENCE/preservation.json`.

- C1. Runtime/client: `src/battle/worker/create-browser-runtime.ts`, `src/battle/app/DuelWorkerClient.ts`.
- C2. Contract: `src/battle/ports/battle-runtime-source.ts`, `src/battle/ports/index.ts`, `src/battle/duel/contracts/duel-command.ts`.
- C3. Regressions: `tests/integration/installed-runtime-wasm.test.ts`, `tests/unit/duel-worker-client.test.ts`, `tests/unit/battle-runtime-input.test.ts`, `tests/unit/domain-boundaries.test.ts`, `e2e-content/t7-runtime.spec.ts`.
- C4. Tracking/evidence: `artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md`, this report, `artifacts/T7-REPAIR-EVIDENCE/`. Prior report/review/evidence byte-identical; unrelated T7 implementation preserved.

**Next action:** open `artifacts/T7-REPAIR-EVIDENCE/commands.json` for independent acceptance review.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Runtime review B1-B4 repaired narrowly; 7 intended RED failures become 87/87 green; source pin matches unchanged vendor. Same-interval benchmark includes Shell source.load; no >20% measured regression."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Retained rerunnable benchmark, exact commands/exits/logs, real Chromium trace/attachment, immutable baseline SHA, before hashes plus preservation report; required independent review remains pending."
    }
  ],
  "changedFiles": [
    "e2e-content/t7-runtime.spec.ts",
    "src/battle/ports/battle-runtime-source.ts",
    "src/battle/ports/index.ts",
    "tests/unit/battle-runtime-input.test.ts",
    "src/battle/app/DuelWorkerClient.ts",
    "src/battle/duel/contracts/duel-command.ts",
    "src/battle/worker/create-browser-runtime.ts",
    "tests/integration/installed-runtime-wasm.test.ts",
    "tests/unit/domain-boundaries.test.ts",
    "tests/unit/duel-worker-client.test.ts",
    "artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md",
    "artifacts/IMPLEMENTATION-REPORT-T7-repair.md",
    "artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs",
    "artifacts/T7-REPAIR-EVIDENCE/scoped-quality.mjs",
    "artifacts/T7-REPAIR-EVIDENCE/check-preservation.mjs",
    "artifacts/T7-REPAIR-EVIDENCE/validate-report.mjs",
    "artifacts/T7-REPAIR-EVIDENCE/commands.json",
    "artifacts/T7-REPAIR-EVIDENCE/preservation.json"
  ],
  "testsAddedOrUpdated": [
    "e2e-content/t7-runtime.spec.ts",
    "tests/unit/battle-runtime-input.test.ts",
    "tests/integration/installed-runtime-wasm.test.ts",
    "tests/unit/domain-boundaries.test.ts",
    "tests/unit/duel-worker-client.test.ts"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/battle-runtime-input.test.ts tests/unit/domain-boundaries.test.ts tests/unit/duel-worker-client.test.ts tests/integration/installed-runtime-wasm.test.ts --reporter=verbose",
      "result": "failed",
      "summary": "Expected RED: 7 failed / 80 passed."
    },
    {
      "command": "npx vitest run tests/unit/battle-runtime-input.test.ts tests/unit/domain-boundaries.test.ts tests/unit/duel-worker-client.test.ts tests/integration/installed-runtime-wasm.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "87/87 passed."
    },
    {
      "command": "node --expose-gc artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs",
      "result": "failed",
      "summary": "Harness attempt1 failed ERR_WORKER_PATH; corrected Worker URL, no product failure."
    },
    {
      "command": "node --expose-gc artifacts/T7-REPAIR-EVIDENCE/benchmark.mjs",
      "result": "passed",
      "summary": "5 fresh processes/lane; startup and combined sampled heap within 1.2 budget."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "0 errors; 4 existing Svelte warnings."
    },
    {
      "command": "npx vitest run tests/unit/battle-runtime-input.test.ts tests/unit/card-visibility.test.ts tests/unit/domain-boundaries.test.ts tests/integration/installed-runtime.test.ts tests/integration/installed-runtime-wasm.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "5 files; 65/65 passed."
    },
    {
      "command": "npx vitest run tests/unit/duel-worker-client.test.ts tests/unit/duel-worker-runtime.test.ts tests/unit/duel-worker-attachment.test.ts tests/unit/duel-store.test.ts tests/unit/installed-battle-images.test.ts tests/unit/resolve-duel-decks.test.ts tests/unit/installed-duel-command.test.ts tests/unit/installed-runtime-receipt-validation.test.ts tests/unit/installed-worker-deck-validation.test.ts tests/integration/worker-runtime.test.ts tests/integration/node-worker-thread.test.ts tests/integration/duel-replay-restore.test.ts tests/component/BattleFacade.test.ts tests/component/AppBoardMapping.test.ts tests/component/AppChrome.test.ts tests/component/AppLocalDecks.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "16 files; 202/202 passed."
    },
    {
      "command": "env -u CONTENT_RUN PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/T7-REPAIR-EVIDENCE/playwright-report.json npx playwright test -c playwright.content.config.ts --project=chromium e2e-content/t7-runtime.spec.ts --output=artifacts/T7-REPAIR-EVIDENCE/browser-results --reporter=line,json",
      "result": "passed",
      "summary": "1/1 passed; real frozen Worker ready/prompt/result, mutant rejected/no ready."
    },
    {
      "command": "node artifacts/T7-REPAIR-EVIDENCE/scoped-quality.mjs",
      "result": "passed",
      "summary": "10 changed code files; ESLint 0 errors/warnings; Prettier passed."
    },
    {
      "command": "npm run vendor:verify",
      "result": "passed",
      "summary": "ocgcore-wasm 0.1.2; 21 files."
    },
    {
      "command": "git diff --check 86631c9",
      "result": "passed",
      "summary": "No whitespace defects."
    },
    {
      "command": "git diff --exit-code 86631c9 -- vendor",
      "result": "passed",
      "summary": "No vendor diff."
    },
    {
      "command": "git diff --cached --quiet",
      "result": "passed",
      "summary": "No staged files."
    },
    {
      "command": "npm run lint",
      "result": "not-run",
      "summary": "Skipped: existing \"No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present\"; explicit-root scoped ESLint passed."
    },
    {
      "command": "graphify . --update",
      "result": "not-run",
      "summary": "Skipped per task: prior Gemini 429 RESOURCE_EXHAUSTED; no external retry."
    },
    {
      "command": "env -u CONTENT_RUN npx playwright test -c playwright.content.config.ts --project=chromium e2e-content/real-installer.spec.ts",
      "result": "not-run",
      "summary": "Skipped per task: prior unrelated cropped-art CONTENT_INVALID_MANIFEST / ASSET_INTEGRITY_FAILED; retained old evidence."
    },
    {
      "command": "node artifacts/T7-REPAIR-EVIDENCE/check-preservation.mjs",
      "result": "failed",
      "summary": "First inventory check falsely classified already-deleted tracked paths/directory symlink as additions; regular-file inventory filter repaired."
    },
    {
      "command": "node artifacts/T7-REPAIR-EVIDENCE/check-preservation.mjs",
      "result": "passed",
      "summary": "2239 unchanged; 11 intentional changes; zero unexpected mutations; vendor unchanged; staging empty; scratch removed."
    },
    {
      "command": "node artifacts/T7-REPAIR-EVIDENCE/validate-report.mjs",
      "result": "passed",
      "summary": "Valid JSON; required fields/string arrays/status-result enums verified against supplied acceptance contract."
    },
    {
      "command": "node artifacts/T7-REPAIR-EVIDENCE/check-preservation.mjs && node artifacts/T7-REPAIR-EVIDENCE/validate-report.mjs && git diff --check 86631c9 && git diff --cached --quiet",
      "result": "passed",
      "summary": "2239 unchanged / 11 intentional changes / 0 unexpected; scratch removed; vendor unchanged; schema check and diff/staging passed."
    }
  ],
  "validationOutput": [
    "RED exit 1: 7 failed / 80 passed. Green exit 0: 87 passed.",
    "Exact T7 exit 0: 65/65; affected exit 0: 202/202; native Chromium exit 0: 1/1.",
    "Typecheck exit 0: 0 errors, 4 existing warnings; vendor exit 0: 21 files; scoped quality exit 0: 10 files, no errors/warnings.",
    "Five fresh processes per lane: startup median 546.72 -> 416.52 ms; combined sampled heap high-water 191753256 -> 147289680 bytes. Same 2136-file input digest, immutable baseline 86631c98f616efc49ecf61e5a3e259c6130bd404.",
    "Preservation exit 0: 2239 unchanged, 11 intentional changes, zero unexpected; vendor diff and staging empty; only own mkdtemp archive copies removed."
  ],
  "residualRisks": [
    "Node warm installed-storage benchmark is not browser-wide heap, cold app startup, actual CacheStorage latency, or exact allocation-peak proof; both isolate heaps counted, shared process RSS counted once.",
    "Full lint skipped: existing duplicate TS config-root failure; old installer cropped-art failures remain out of scope.",
    "Graph updater skipped per task: existing 429 RESOURCE_EXHAUSTED; graph not refreshed.",
    "Independent reviewer acceptance required; no self-acceptance."
  ],
  "noStagedFiles": true,
  "diffSummary": "Worker frozen WASM hash before engine; typed actual-version failure; shutdown stale-event suppression; exact public initialize command plus export/type freeze; red-first regressions; reproducible end-to-end runtime startup/heap evidence; retry1 ledger and valid JSON attestation.",
  "reviewFindings": [
    "Runtime B1-B4 repaired with regression evidence.",
    "Integration measurement B1 replaced with rerunnable same-interval main-plus-Worker measurement, including Shell assembly; prior claim superseded.",
    "No remaining known in-scope blocker; independent reviewer gate pending."
  ],
  "manualNotes": "Sole ROOT writer; parent-provided Astra-high retry1 route. No subagents/staging/commits/push/deploy/vendor edits/T8. Original worktrees and previous evidence untouched. Detailed new evidence inventory: artifacts/T7-REPAIR-EVIDENCE/preservation.json. Next: reviewer inspect commands.json."
}
```
