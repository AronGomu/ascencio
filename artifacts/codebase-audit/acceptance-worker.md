# Acceptance worker — stopped, partial acceptance

## State

- S1. Four scoped oracle fixes implemented by preceding attempt; recovered unchanged. This attempt supervised existing matrix, inspected evidence, removed owned disposable specs. No new implementation edits, probe, retry, optimization, staging, commit, review launch.
- S2. **Uncommitted, unreviewed. Perf acceptance FAILED. Slow-control causal validation incomplete.** User STOP honored; no further work scheduled.
- S3. Worktree: `/home/aron/Projects/ascencio/.tmp/codebase-audit-acceptance`; HEAD `0bbe94e6115221e98a2d505c1e69241c066cde57`. All relative paths below resolve there unless explicitly absolute.
- S4. Recovered matrix completed naturally: **5 expected outcomes, 3 unexpected failures, 52.4m**. `artifacts/oracle-validation/oracle-matrix.json` → `stats.expected=5`, `unexpected=3`, `skipped=0`. Expected failures count among five expected outcomes; this is NOT five ordinary green tests.
- S5. Final PID inspection: former runner722478/server722778/worker754628/Chrome754689/replacement-worker795178 absent. `/proc` cwd scan found no browser/runner/server beyond inspection shell matching its own command text. `ss -ltnp '( sport = :4518 )'` returned header only. No termination required.

## Assumptions / scope

- A1. Approved findings only: root `artifacts/codebase-audit/test-shard-1.md` F1; shard2 F2/F3; shard6 F1. Shard2 F1 belongs separate worker.
- A2. Preserve failing unchanged perf gate; no prod optimization, threshold/workload relaxation, deps/install, owner-dirty Node26 config/Worker-exit tests, shared data cleanup.
- A3. Prior-attempt logs establish historical unit/build results. Exact historical unit/lint/format invocation not recovered; not presented as freshly rerun validation. Handoff says scoped lint/format passed; no retained output independently confirms that claim.
- A4. Synthetic public state clones exercise real `DuelWorkerClient` parser/reducer/Svelte path. Visible unique turn correlates revision. Two rAF callbacks remain paint proxy, not GPU presentation timestamp; no engine computation included.

## Intentional changes

- C1. `tests/unit/core-update-approval.test.ts:91–181`: execute real SW install handler through sandboxed imports; pending/null/wrong-build/wrong-API approval blocks precache; matching approval permits once. Source-copy early-install mutation rejected. 87 insertions, 3 deletions.
- C2. `tests/unit/domain-boundaries.test.ts:192–202,1049–1082`: purity-specific external-import collection; synthetic `idb`, `node:fs` rejection; general boundary semantics unchanged. 31 insertions, 10 deletions.
- C3. `e2e/duel-smoke.spec.ts:1307–1365`: same-document shell navigation, capture identity preserved, five former duel leases checked individually; destination leases allowed.
- C4. `e2e/duel-smoke.spec.ts:4965–5123,6288–6375`: 5 warmups, 30 distinct accepted revision/visible-turn→two-rAF pairs; alternating focus targets; long tasks restricted to actual measured workload. No CDP/polling within update sample. C3+C4: 174 insertions, 84 deletions. No prod or budget files changed.

## Evidence

- E1. Unit historical green: `artifacts/oracle-validation/unit-green.log` → `Test Files  2 passed (2)`; `Tests  58 passed (58)`.
- E2. Shell red: `artifacts/oracle-validation/shell-red.log` → `AssertionError: expected [] to deeply equal [ 'idb' ]`; corresponding `node:fs` failure. Two synthetic regressions reject old collector.
- E3. SW red: `artifacts/oracle-validation/sw-order-red.log` → `AssertionError: precache must wait for approval: expected "vi.fn()" to not be called at all, but actually been called 1 times`. Restored suite green per E1.
- E4. Build historical result: `artifacts/oracle-validation/build-verify.log` → `"status": "ok"`, `"mode": "core"`, `"delivery": "unavailable"`. Not private/full-product acceptance.
- E5. Typecheck historical failure, untouched fixture: `.tmp/oracle-validation/typecheck.log` → `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.`
- E6. Graph-first attempt failed: `/bin/bash: line 1: graphify: command not found`. Direct targeted inspection substituted.

### Browser matrix

Exact recovered invocation; trace/video off via preserved config:

```sh
PLAYWRIGHT_PORT=4518 ORACLE_RUN=oracle-matrix PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/oracle-validation/oracle-matrix.json node node_modules/@playwright/test/cli.js test --config .tmp/oracle-validation/playwright.config.ts --project=chromium e2e/duel-smoke.spec.ts e2e/oracle-slow-leak.spec.ts e2e/oracle-missing-update.spec.ts e2e/zz-oracle-restored.spec.ts --grep 'DF-16 Chromium|mounted card image leases' --reporter=list,json
```

- B1. Baseline lifecycle **PASS**: `artifacts/oracle-validation/oracle-matrix/duel-smoke-installed-media-179a3-ss-tray-restart-and-destroy-chromium/df-13-object-url-lifecycle.json`. Former leases5, created49/revoked49/active0; same-document capture true.
- B2. Baseline DF-16 **FAIL**: `artifacts/oracle-validation/oracle-matrix/duel-smoke-DF-16-Chromium--8986b--records-automated-evidence-chromium/df-16-results.json`. Thirty unique revision/turn pairs, ordered marks; update p50 **88.6ms**, p95 **127.5ms**, min54ms; focus p95 **44.6ms**; **22** long tasks. Exact failure: `Error: expect(received).toBeLessThan(expected)` / `Expected: < 50` / `Received:   127.5`.
- B3. Baseline resource evidence passes recorded conditions: URL growth0, active URLs match mounted before/after, obsolete overlap0, listener growth−2. Later resource assertions not reached after first percentile assertion failure; evidence conditions, not separately passed assertions.
- B4. Phase split: `artifacts/oracle-validation/baseline-phase-summary.json`. Ingress→DOM p50 **51.8ms**, p95 **82.6ms**; DOM→paint p50 **35.4ms**, p95 **48.9ms**. No CPU profile captured.
- B5. Missing-state negative **expected failure**: `artifacts/oracle-validation/oracle-matrix/oracle-missing-update-DF-1-126c2--records-automated-evidence-chromium/error-context.md`: `Error: page.evaluate: Error: DF-16 revision 11 did not render`. Replayed previous state instead of distinct revision cannot satisfy visible-marker sample. Its unrelated lifecycle case passed.
- B6. Suppressed-revoke negative **expected failure**: `artifacts/oracle-validation/oracle-matrix/oracle-slow-leak-installed-7d8d4-ss-tray-restart-and-destroy-chromium/error-context.md`: `Error: expect(received).toEqual(expected) // deep equality`; actual `notRevoked`/`stillActive` each contain same five former URLs; expected empty arrays. `Timeout 30000ms exceeded while waiting on the predicate`. Same document reached main menu; no navigation-reset false green.
- B7. Slow120ms negative **INCONCLUSIVE**, not claimed detection: `artifacts/oracle-validation/oracle-matrix/oracle-slow-leak-DF-16-Chr-41652--records-automated-evidence-chromium/error-context.md`: `Test timeout of 180000ms exceeded.` / `Error: locator.click: Test timeout of 180000ms exceeded.` during later resource restart, waiting for `[data-cy="duel-right-rail-options"]`. Raw measured pairs were not persisted before timeout. No receivedAt→renderedAt/duration causal comparison available. User STOP canceled proposed retry.
- B8. Restored destination-lease control **PASS**: `artifacts/oracle-validation/oracle-matrix/zz-oracle-restored-install-1c00a-ss-tray-restart-and-destroy-chromium/df-13-object-url-lifecycle.json`. Five former leases revoked; created38/revoked37/active1; destinationActiveLeases1; sameDocumentCapture true. Unrelated destination URL does not fail cleanup oracle.
- B9. Restored DF-16 **FAIL**, never fabricated green: `artifacts/oracle-validation/oracle-matrix/zz-oracle-restored-DF-16-C-28a65--records-automated-evidence-chromium/df-16-results.json`. Update p95 **122.89999999850988ms**, focus p95 **44.80000000074506ms**, **29** long tasks. Exact gate output: `Expected: < 50` / `Received:   122.89999999850988`.

## Ownership / cleanup handoff

- O1. Intentional tracked changes: exactly C1–C4's three test files. Final `git diff --cached --name-only` empty. No stage/commit. Independent root-worker field-failure changes not imported or overwritten.
- O2. Removed exact owned disposable paths after matrix completion: `e2e/oracle-missing-update.spec.ts`, `e2e/oracle-slow-leak.spec.ts`, `e2e/zz-oracle-restored.spec.ts`. Read/identity-check before unlink. Reproduction generator retained: `artifacts/oracle-validation/create-browser-probes.py`; full matrix errors retained. No source test deletion.
- O3. Retained evidence: entire `artifacts/oracle-validation/` including matrix JSON/log/output attachments, red/green/build logs, phase summary, probe generator. Previous trace-on/interrupted logs `green-1.log`, `green-2.log` are NOT pass evidence.
- O4. Retained isolated validation scratch for parent-owned final cleanup: `.tmp/oracle-validation/playwright.config.ts`, `.tmp/oracle-validation/vite.config.ts`, `.tmp/oracle-validation/vitest.config.ts`, `.tmp/oracle-validation/vitest-cache/`, `.tmp/oracle-validation/typecheck.log`, `.tmp/oracle-validation/sw.log`; `dist/`; `generated/asset-delivery/prepared-player.json`; `test-results/df-16-results.json` (last write, not baseline authority).
- O5. Retained `node_modules` symlink → `/home/aron/Projects/ascencio/node_modules`; never remove target. `public/story/shop-sets.v1.json` is tracked, unchanged; not cleanup scratch. Shared/root generated assets, caches, deps untouched. Parent owns final worktree/scratch cleanup; no recursive cleanup attempted.
- O6. Final report deliverable: `/home/aron/Projects/ascencio/artifacts/codebase-audit/acceptance-worker.md`.

## Residual / unfinished acceptance

- R1. Slow120ms causal proof missing. Baseline already fails same gate; unrelated timeout proves nothing about injected latency detection.
- R2. Corrected baseline/restored perf fail unchanged budgets; no full private/perf acceptance. No optimization attempted.
- R3. Full typecheck blocked by existing fixture error; scoped lint/format only inherited claim, not freshly rerun. Full suite not run.
- R4. Review gate **not performed**, explicitly canceled by user STOP. Patch remains unreviewed/uncommitted. No next review/probe/optimization launched.
- R5. Exact source fingerprints: `e2e/duel-smoke.spec.ts` SHA256 `b03faf08bcfaa91654b1be98fe633e98d3a73c56d93c548b912b02827d4effc7`; `tests/unit/core-update-approval.test.ts` `ee68cb42091b81ddedcfd759db3a4ec4621c6910821f01314771a721fa032f9d`; `tests/unit/domain-boundaries.test.ts` `fa79b166ce934bb2b796e31beb1d7b5bdd4eb28900f4275a9e68e7764be254cf`.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Four approved oracle repairs confined to three test files; production/budgets unchanged. Prior implementation preserved; current diff 292 insertions, 97 deletions."
    },
    {
      "id": "criterion-2",
      "status": "not-satisfied",
      "evidence": "Matrix JSON/raw baseline/restored samples, lifecycle controls, SW/Shell red-green evidence preserved; slow120ms causal metrics missing after resource timeout. Required review canceled by user STOP."
    }
  ],
  "changedFiles": [
    "e2e/duel-smoke.spec.ts",
    "tests/unit/core-update-approval.test.ts",
    "tests/unit/domain-boundaries.test.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/unit/core-update-approval.test.ts: behavioral approval gating; early-install source-copy mutation",
    "tests/unit/domain-boundaries.test.ts: synthetic idb/node:fs purity negatives",
    "e2e/duel-smoke.spec.ts: same-document lease cleanup; 30 correlated accepted-update paint samples"
  ],
  "commandsRun": [
    {
      "command": "PLAYWRIGHT_PORT=4518 ORACLE_RUN=oracle-matrix PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/oracle-validation/oracle-matrix.json node node_modules/@playwright/test/cli.js test --config .tmp/oracle-validation/playwright.config.ts --project=chromium e2e/duel-smoke.spec.ts e2e/oracle-slow-leak.spec.ts e2e/oracle-missing-update.spec.ts e2e/zz-oracle-restored.spec.ts --grep 'DF-16 Chromium|mounted card image leases' --reporter=list,json",
      "result": "failed",
      "summary": "Inherited running job supervised through completion, not relaunched: 5 expected outcomes, 3 unexpected failures, 52.4m."
    },
    {
      "command": "cat artifacts/oracle-validation/unit-green.log artifacts/oracle-validation/shell-red.log artifacts/oracle-validation/sw-order-red.log artifacts/oracle-validation/build-verify.log .tmp/oracle-validation/typecheck.log",
      "result": "passed",
      "summary": "Inspected historical logs: 58 unit tests green; Shell/SW mutations red; core build verified; existing TS2345 failure. Not fresh test execution."
    },
    {
      "command": "graphify query \"How do core update approval tests, pure shell import boundaries, duel performance and image lease cleanup tests work?\"",
      "result": "failed",
      "summary": "/bin/bash: line 1: graphify: command not found"
    },
    {
      "command": "git diff --cached --name-only; git diff --name-only; git diff --numstat; git status --short",
      "result": "passed",
      "summary": "No staged files. Three intentional tracked test changes; retained evidence/node_modules symlink untracked."
    },
    {
      "command": "ps -o pid,ppid,pgid,lstart,args -p 722478,722778,754628,754689,795178; ss -ltnp '( sport = :4518 )'",
      "result": "passed",
      "summary": "Former owned processes absent; port4518 not listening. No termination needed."
    }
  ],
  "validationOutput": [
    "Historical scoped units: 58 passed, 2 files.",
    "Baseline lifecycle passed: former5 revoked; created49/revoked49/active0.",
    "Missing-state negative: Error: page.evaluate: Error: DF-16 revision 11 did not render.",
    "Suppressed revoke: expected empty notRevoked/stillActive arrays; five former URLs remained in each.",
    "Restored destination lease passed: former5 revoked; one unrelated active URL allowed.",
    "Baseline update p95 127.5ms; restored p95 122.89999999850988ms; unchanged limit <50ms.",
    "Slow negative timed out during resource restart; no causal latency evidence."
  ],
  "residualRisks": [
    "Unreviewed/uncommitted patch; required review canceled by user STOP.",
    "Perf acceptance failed; no full private/product acceptance.",
    "Slow120ms mutation causal validation incomplete; no retry launched.",
    "Existing TS2345 blocks full typecheck; lint/format not rerun this attempt.",
    "Isolated evidence/config/fixtures retained for parent cleanup; shared targets untouched."
  ],
  "noStagedFiles": true,
  "diffSummary": "Test-only approval-order, external-import purity, same-document lease cleanup, accepted-update paint oracles; no production or budget changes.",
  "reviewFindings": [
    "Review gate not run: user STOP.",
    "Acceptance blocker: slow-control timeout lacks required causal metrics.",
    "Perf acceptance blocker: corrected baseline/restored update percentile exceeds unchanged 50ms budget."
  ],
  "manualNotes": "Stopped. No further work scheduled. Three disposable e2e mutation specs removed after completed matrix; generator/evidence preserved. Parent owns retained isolated scratch/worktree cleanup."
}
```
