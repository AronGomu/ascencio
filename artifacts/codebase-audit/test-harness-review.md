# Test-harness integrity review — done

## Review

- R1. **Correct — approve all ten assigned fixes.** Independent source inspection, 177 focused tests passed; mutation/cleanup controls below reproduced. No corrective repo edits needed.
- R2. **Fixed — none by reviewer.** Worker changes retained byte-identical. Report sole reviewer deliverable.
- R3. **Blocker — none within ten-fix scope.** Whole-repo acceptance not claimed: existing TS error, intermittent handoff wait failures remain.
- R4. **Note — P2, pre-existing repeatability gap.** `tests/component/StoryDuelHandoff.test.ts:208–216,301–308`: restored suite passed 13/13 initially, then failed 1/13, then 2/13, finally passed 13/13. Failures: `AssertionError: waiting for data-cy="battle-root": expected null not to be null`; subsequent seat assertion: `AssertionError: expected 0 to be greater than 0`. Cold-checkpoint target passed restored full-suite runs. Existing 5s mount wait, default `startedSeats()` wait unchanged; no timeout inflation. Next action: parent track lazy-domain readiness/test isolation separately; passing retry does not establish flake-free suite.
- R5. **Note — P2, parent-owned type gate.** `tests/fixtures/node-duel-worker-harness.ts:96`: full `tsc` reproduces sole known `unknown`→`Error` error. Scoped ten-path types pass. Next action: parent resolve existing fixture mismatch separately.

## Ten approvals

| ID | Approval · evidence |
|---|---|
| F1 | Producer exact-owned teardown: `tests/progressive-producer.test.ts:35–37`. `after()` registered immediately after `mkdtemp()`, before setup. Success/setup-failure/assertion-failure controls remove 2/1/1 created roots; sibling sentinel survives. |
| F2 | Publisher exact-owned teardown: `tests/progressive-publisher.test.ts:26–28`. Same registration order. Success/setup-failure/assertion-failure controls remove 1/1/1 roots; sibling sentinel survives. No prefix-wide cleanup. |
| F3 | CRC independent oracle: `tests/asset-delivery-bundle.test.ts:611–660`. Descriptor-free ZIP; valid archive accepted; independent wrong SHA rejected with `ASSET_INTEGRITY_FAILED`; matching local/central CRC fields corrupted while payload/SHA preserved. Disabling both production `checkSignature` options kills test exactly at CRC assertion, line 648. Restored guard passes. |
| F4 | MIME envelope rebinding: `tests/progressive-producer.test.ts:459–511,593–610`. Rewriter updates `validation.json.manifestVersion`, asserts complete envelope/predecessor identity. Removing only expected-manifest roster equality kills MIME test at line 602; restored MIME + valid predecessor controls pass. Validation-envelope guard remains active throughout mutant. |
| F5 | Default Node26 JSDOM storage: `vitest.config.ts:9–10`; `tests/component/jsdom-storage.test.ts:5–24`. Config supplies worker `execArgv`, does not replace `NODE_OPTIONS`. Node v26.7.0, default CLI facade 19/19; storage 1/1; threads 1/1. Removing config flag fails `Storage` assertion; restoration passes. Existing `NODE_OPTIONS=--trace-warnings` + nested Worker failure-path controls pass. |
| F6 | Occupied Load fixture: `tests/component/story/cancel-controls.test.ts:184–187`. Non-null `manualSummary` reaches occupied-slot Delete branch, matching `src/story/screens/LoadScreen.svelte:64–97`. Danger/cancel checks unchanged. Cancel/Load/editor/ownership suites 26/26. |
| F7 | Unavailable editor tile remains operable: `tests/component/deck-editor/editor-import.test.ts:168–216`. Asserts dimmed, enabled, absent catalog ADD tile; real click previews exact name without mutation; double-click emits exact indexed removal once. Adjacent ownership-cap suite passes. No tile/grid/product edits. |
| F8 | Section-qualified pre-battle selector: `tests/component/story/pre-battle-deck-picker.test.ts:154–166`. Two selectors include `main`, matching `src/deck-select/DecklistPanel.svelte:80–96`; Link color assertion retained. Suite 25/25. No Archive-label additions duplicated. |
| F9 | Cold-restored start precedes outcome: `tests/component/StoryDuelHandoff.test.ts:450–483`. Checkpoint includes fieldable deck/default/collection; `startedSeats()` waits for actual `startDuel` boundary call, checks main/extra/side, absent picker, then emits result. Removing checkpoint deck fields produces `starts.length === 0` failure at line 307; restoration passes target. Worker client mocked by design (`:39–75`): component-level start proof, not real browser Worker/WASM execution. |
| F10 | Seed-only privacy exclusion: `tests/unit/duel-worker-runtime.test.ts:955–1025`. Valid adversarial seed `12200034567890123456n` contains opponent code `22000`; seed/sensitivity asserted separately. Only `diagnostics.trace.seed` omitted; ordinary events, remaining metadata, entries scanned. Three outside-seed leak controls reject injected code. Reintroducing seed into scan fails; excluding whole trace fails metadata leak control at line 1011. Restored full suite 29/29. RNG spy restored via `onTestFinished`. |

## Independent execution

- E1. Cwd baseline `/home/aron/Projects/ascencio/.tmp/codebase-audit-test-harness`, HEAD `0bbe94e6115221e98a2d505c1e69241c066cde57`; Node `v26.7.0`, Vitest `4.1.10`.
- E2. `graphify query "test harness producer publisher CRC storage story handoff privacy"` unavailable: `/bin/bash: line 1: graphify: command not found`. Direct diff/source inspection substituted.
- E3. Original external deps symlink reproduced setup failure before collection: `Error: Cannot find module '/@fs/home/aron/Projects/ascencio/node_modules/@testing-library/svelte/src/vitest.js'`. No symlink replacement. Copied current tracked sources + new storage test + installed deps into exact-owned `.tmp/review-harness-a81e/repo`; no install/package edits. All subsequent runtime/quality cmds below used copied cwd. `NODE_OPTIONS` unset unless explicitly specified.
- E4. `python .tmp/review-harness-a81e/probe.py suites`: Node suites 64/64, default facade 19/19, storage 1/1, stale-fixture/adjacent guard suites 26/26, picker 25/25, handoff 13/13, runtime 29/29. **177 passed**, no skipped tests in full focused runs. Producer/publisher roots remaining: **0**.
- E5. Exact default cmd independently repeated: `env -u NODE_OPTIONS npx vitest run tests/component/BattleFacade.test.ts --maxWorkers=1` → **19 passed**. No manual storage flag.
- E6. `python .tmp/review-harness-a81e/probe.py controls`: CRC/MIME mutants each exit 1 with `AssertionError [ERR_ASSERTION]: Missing expected rejection.`; restored CRC 1/1, restored MIME/predecessor 2/2. Six cleanup controls assert expected child exit status, recorded root absence, preserved sentinel bytes. Setup/assertion failures injected only into copied tests; guards mutated only in copied scripts.
- E7. Same driver: removing config flag → `AssertionError: expected undefined to be an instance of Storage`; restored config → 1/1; threads → 1/1. Reintroducing diagnostic seed → privacy scan fails containing `22000`; restored oracle → 1/1 selected test.
- E8. `NODE_OPTIONS=--trace-warnings npx --no-install vitest run tests/component/jsdom-storage.test.ts tests/integration/node-worker-thread.test.ts --maxWorkers=1 -t 'provides JSDOM storage|returns a typed initialization failure|surfaces cleanup failure'` → **3 passed, 5 filtered out**. Existing env flag preserved; nested Worker typed-init/error-cleanup paths pass.
- E9. Extra copied-source controls: excluding entire trace → `AssertionError: expected [Function] to throw an error` at privacy line 1011. Empty-checkpoint full-file run → **12 passed, 1 failed**, exact intended `AssertionError: expected 0 to be greater than 0`. Initial targeted attempt instead hit mount timeout, not counted as start-oracle proof. Final restored serial handoff → **13 passed**; runtime → **29 passed**. Intervening restored failures retained in R4, not hidden by final green.
- E10. `python .tmp/review-harness-a81e/probe.py quality`: `npx --no-install tsc --noEmit -p tsconfig.review.json`, scoped ESLint, scoped Prettier → exit **0**. Scratch TS config extended root config; included all ten changed TS/config paths + `src/**/*.d.ts` + transitive imports. Prettier: `All matched files use Prettier code style!`.
- E11. Full `npx --no-install tsc --noEmit` → exit **2**, sole diagnostic: `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.`
- E12. Final byte comparison: all ten reviewed files match executed restored copy; **514 src files, 147 scripts files, 22 vendor files** byte-identical between original worktree/copy. `git diff --name-only -- src scripts vendor package.json package-lock.json .github` empty. Production privacy/randomness/guards untouched; no new timeout/skip changes anywhere in diff. Frozen vendor not changed.
- E13. `git diff --check` passes; `git diff --cached --name-only` empty. Original link remains `/home/aron/Projects/ascencio/node_modules`. Reviewer scratch/probe logs/copied deps removed by exact-owned cleanup: `/home/aron/Projects/ascencio/.tmp/codebase-audit-test-harness/.tmp/review-harness-a81e`. Empty `.tmp/` remains. No commits/staging/subagents.

## Assumptions

- A1. Review covers ten worker fixes against current worktree diff, not unrelated owner/root changes.
- A2. Teardown contract covers ordinary setup/assertion/test completion; SIGKILL/crash not covered.
- A3. Owned local-deps copy isolates documented external-symlink resolution artifact; original symlink itself is not repaired. Source equality verified before cleanup.
- A4. Handoff acceptance means production shell/coordinator reaches mocked Worker client `startDuel` before injected result; real browser cold restore remains E2E scope.

## Residual risks / exact next actions

- G1. **P2 repeatability:** R4 failures reproduced. Parent track deterministic lazy-domain readiness/test teardown follow-up; do not increase broad timeouts or count retries as stability proof.
- G2. **P2 type gate:** R5 known fixture mismatch remains. Parent owns separate fix; reviewer made none.
- G3. **Environment:** default storage verified with local deps; original external-link worktree still fails Vitest setup independently of storage. Run parent checkout with normal local deps, or same exact-owned-copy approach.
- G4. **Merge:** parent preserve separate UI-worker Archive additions in `tests/component/story/pre-battle-deck-picker.test.ts`; worker diff remains only two selector hunks.
- G5. **Out of scope:** parent-reported integrated 57-test `1→0` owner-dirty failure not rerun/fixed here. Full repo suites/browser builds/real Worker cold reload not executed. Node24 not executed. No full-repo green claim.

## Files touched

- C1. Deliverable only: `/home/aron/Projects/ascencio/artifacts/codebase-audit/test-harness-review.md`.
- C2. Temporary owned probes/copied repo only; removed per E13. No corrective test/config edits. Inherited ten-file worker diff preserved.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1–F10 approve all assigned repairs with exact paths/lines; E1–E13 record independent execution; R4/R5 and G1–G5 disclose severity, scope gaps, next actions."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/test-harness-review.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "env -u NODE_OPTIONS npx --no-install vitest run tests/component/jsdom-storage.test.ts tests/component/BattleFacade.test.ts --maxWorkers=1",
      "result": "failed",
      "summary": "Original worktree external deps symlink: setup module-resolution failure; no tests collected."
    },
    {
      "command": "python .tmp/review-harness-a81e/probe.py prepare; python .tmp/review-harness-a81e/probe.py suites",
      "result": "passed",
      "summary": "Owned source/deps copy; 177 focused tests passed, zero producer/publisher roots retained."
    },
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts tests/asset-delivery-bundle.test.ts",
      "result": "passed",
      "summary": "64 passed, zero failures/skips; copied cwd."
    },
    {
      "command": "env -u NODE_OPTIONS npx vitest run tests/component/BattleFacade.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "19 passed with default CLI, Node26, local deps, no manual storage flags."
    },
    {
      "command": "python .tmp/review-harness-a81e/probe.py controls",
      "result": "passed",
      "summary": "CRC/MIME mutant failures verified, guards restored green; six cleanup paths/sentinels pass; storage red/green/threads; adversarial seed red/green."
    },
    {
      "command": "NODE_OPTIONS=--trace-warnings npx --no-install vitest run tests/component/jsdom-storage.test.ts tests/integration/node-worker-thread.test.ts --maxWorkers=1 -t 'provides JSDOM storage|returns a typed initialization failure|surfaces cleanup failure'",
      "result": "passed",
      "summary": "3 passed, 5 filtered out; existing env flags/nested Worker paths retained."
    },
    {
      "command": "python .tmp/review-harness-a81e/extra_controls.py",
      "result": "failed",
      "summary": "Broader trace exclusion killed; full-file empty checkpoint killed at starts=0. Initial targeted probe hit mount timeout; later restored suite hit existing mount flake. Driver correctly refused false-green success."
    },
    {
      "command": "env -u NODE_OPTIONS npx --no-install vitest run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "Final serial run 13 passed. Earlier restored retries 12/13 and 11/13; not flake-free."
    },
    {
      "command": "env -u NODE_OPTIONS npx --no-install vitest run tests/unit/duel-worker-runtime.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "Final restored runtime suite 29 passed; adversarial seed plus three outside-seed negative controls."
    },
    {
      "command": "python .tmp/review-harness-a81e/probe.py quality",
      "result": "passed",
      "summary": "Ten-path types/lint/format exit 0; driver separately confirms known full-project TS failure."
    },
    {
      "command": "npx --no-install tsc --noEmit",
      "result": "failed",
      "summary": "Known sole TS2345 at tests/fixtures/node-duel-worker-harness.ts(96,33)."
    },
    {
      "command": "python .tmp/review-harness-a81e/probe.py cleanup; git diff --check; git diff --cached --name-only; readlink node_modules",
      "result": "passed",
      "summary": "Owned scratch removed; whitespace clean; nothing staged; original link preserved."
    }
  ],
  "validationOutput": [
    "E1. Focused full runs: 64 + 19 + 1 + 26 + 25 + 13 + 29 = 177 passed.",
    "E2. CRC/MIME mutants each reach Missing expected rejection.; restored guards pass.",
    "E3. Producer roots 2/1/1; publisher roots 1/1/1; all removed across success/setup/assertion failure, sentinels unchanged.",
    "E4. Default Node26 storage/facade, forks/threads, inherited NODE_OPTIONS controls pass.",
    "E5. Empty checkpoint fails before outcome at starts=0; restored cold target passes.",
    "E6. Seed inclusion fails colliding code; overbroad trace exclusion fails negative leak control.",
    "E7. Scoped types/lint/format/diff pass; whole TS baseline failure remains."
  ],
  "residualRisks": [
    "G1. Existing handoff lazy-mount/seat wait flake reproduced; final pass does not prove stable timing.",
    "G2. Existing parent-owned TS2345 remains.",
    "G3. Original external deps symlink setup failure remains; local-copy runtime evidence explicit.",
    "G4. Parent merge must preserve independent Archive additions beside two selector hunks.",
    "G5. Owner-dirty integrated assertion failure untouched; full repo/browser/Node24 not validated."
  ],
  "noStagedFiles": true,
  "diffSummary": "Reviewer changed no tests/config/source. Ten worker changes approved intact; report only deliverable. No production privacy/randomness/guard, timeout, skip, package, lock, CI edits.",
  "reviewFindings": [
    "F1. No in-scope blocker: all ten fixes independently approved with evidence above.",
    "R4. P2 pre-existing intermittent wait failures: tests/component/StoryDuelHandoff.test.ts:208–216,301–308.",
    "R5. P2 parent-owned type failure: tests/fixtures/node-duel-worker-harness.ts:96."
  ],
  "manualNotes": "No installs, commits, staging, subagents. Original deps symlink never replaced. Mutations confined to owned copy, restored byte-identical before exact-owned scratch deletion. No further writes after report."
}
```
