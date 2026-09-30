# Test harness repairs — done

## Evidence

- E1. Node `v26.7.0`, Vitest `4.1.10`; isolated worktree `/home/aron/Projects/ascencio/.tmp/codebase-audit-test-harness`, HEAD `0bbe94e6115221e98a2d505c1e69241c066cde57`.
- E2. Focused Node suites: **64 passed, 0 failed**. Default `BattleFacade`: **19 passed**. Default storage regression + facade: **20 passed**. Appended fixture fixes + adjacent guard suites: **26 passed**. Pre-battle picker: **25 passed**. Story handoff: **13 passed**. Worker runtime: **29 passed**.
- E3. CRC/MIME mutations: old tests **falsely passed**; repaired tests **failed** with `AssertionError [ERR_ASSERTION]: Missing expected rejection.` Restored guards: **passed**.
- E4. Producer/publisher cleanup: successful tests, injected setup failures, injected assertion failures → **zero owned roots remain**. Sentinel dirs unchanged. Before fixes, every recorded root remained.
- E5. Scoped TypeScript, ESLint, Prettier, `git diff --check`: **passed**. Whole-project TypeScript retains exact pre-existing error below.

## Findings repaired

- F1. **P2 — publisher fixture leak.** `tests/progressive-publisher.test.ts:26–28`: unique `.tmp/` root; immediate Node `after()` registration removes exact owned root, including setup failures. No prefix sweep.
- F2. **P3 — producer fixture leak.** `tests/progressive-producer.test.ts:35–37`: same ownership/teardown contract.
- F3. **P3 — CRC false-green oracle.** `tests/asset-delivery-bundle.test.ts:611–660`: disable data descriptors in tiny control ZIP; preserve payload/SHA; corrupt matching local/central CRC fields; update archive ref hash. Valid archive succeeds; independent bad file SHA requires `ASSET_INTEGRITY_FAILED`; CRC case requires exact `ASSET_ARCHIVE_REJECTED`.
- F4. **P2 — stale MIME validation envelope.** `tests/progressive-producer.test.ts:459–492`: `rewriteManifest()` updates `validation.json.manifestVersion`, preserves predecessor metadata, asserts exact envelope identity. Positive predecessor control at `:496–511` passes production verification.
- F5. **P2 — Node26 storage shadows JSDOM.** `vitest.config.ts:9–10`: additive Vitest `execArgv: ["--no-experimental-webstorage"]`; no `NODE_OPTIONS` overwrite. New `tests/component/jsdom-storage.test.ts:5–24` checks genuine `Storage` instances, empty defaults, distinct local/session stores, independent round trips, `clear()`. No per-test storage patches.
- F6. **P2 — stale occupied-save fixture.** `tests/component/story/cancel-controls.test.ts:184–187`: explicit `manualSummary: "Chapter 1 · Old Arena"` enables Delete affordance. Existing danger/cancel assertions unchanged; no `LoadScreen` edit.
- F7. **P2 — stale ownership assertion.** `tests/component/deck-editor/editor-import.test.ts:168–216`: unavailable tile remains dimmed, enabled; actual user click shows card preview, double-click dispatches exact indexed removal once. No unavailable catalog ADD affordance. Adjacent owned-only suite verifies ownership caps. No production tile/grid edit.

- F8. **P2 — stale sectionless decklist selector.** `tests/component/story/pre-battle-deck-picker.test.ts:154–166`: two exact selector updates to `deck-select-seat-list-player-main-row-1322368`; existing Link frame `"#1d6ea8"` assertion retained. Current emitter: `src/deck-select/DecklistPanel.svelte:73–96`. No Archive-label edits; parent merges concurrent UI-worker additions on same path.
- F9. **P3 — cold-start outcome injected before duel start.** `tests/component/StoryDuelHandoff.test.ts:452–480`: reuse `fieldableStoryDeck()`, seed checkpoint deck/default/collection; await `startedSeats()`; assert exact restored main/extra/side, absent picker before surrender. No production handoff changes.
- F10. **P2 — privacy oracle misreads diagnostic RNG.** `tests/unit/duel-worker-runtime.test.ts:955–1025`: feed valid colliding seed `[12200034567890123456n, 2n, 3n, 4n]` through test-only `crypto.getRandomValues` spy; restore spy on test finish. Assert exact diagnostic seed/sensitivity separately; omit ONLY `diagnostics.trace.seed` from opponent-code scan. All ordinary-event fields, remaining trace metadata, entries still scanned. Three deliberate `22000` injections (ordinary event, diagnostic preset metadata, diagnostic entry) each must throw. Production randomness/privacy guards untouched.

## Mechanism inspection

- M1. Vitest `node_modules/vitest/dist/chunks/index.DC7d2Pf8.js:242–247`: JSDOM `getWindowKeys()` skips already-present globals unless explicitly overridden. Node26 exposes unavailable `localStorage`; inherited global blocks JSDOM replacement. `:523` calls `populateGlobal()` before setup files.
- M2. Vitest `node_modules/vitest/dist/chunks/cli-api*.js:3660–3668`: worker argv concatenates Vitest defaults, resolution conditions, configured `execArgv`. `:3650–3655` inherits process env. Config flag therefore runs before JSDOM setup without replacing existing env flags. Forks, threads, nested Node Worker failure-path checks passed.
- M3. Production checks untouched: `scripts/lib/asset-delivery/verify-archive.ts:46–49,92–96`; `scripts/lib/asset-delivery/progressive-producer.ts:423–436,518–529`. Final `git diff --name-only -- scripts src vendor package.json package-lock.json .github` returned empty.

## Red/green evidence

- V1. **Storage red:** `env -u NODE_OPTIONS npx vitest run tests/component/jsdom-storage.test.ts tests/component/BattleFacade.test.ts --maxWorkers=1` before config fix → **20 failed**: 19 facade failures, one new regression failure. Exact diagnostics: `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.`; `AssertionError: expected undefined to be an instance of Storage`. Parent repro also records `TypeError: Cannot read properties of undefined (reading 'clear')` at facade line 189.
- V2. **Storage green:** same command after config fix → **20 passed**. Exact requested default command `npx vitest run tests/component/BattleFacade.test.ts --maxWorkers=1` → **19 passed**, no manual env flags.
- V3. **Pool/flag controls:** `env -u NODE_OPTIONS npx vitest run tests/component/jsdom-storage.test.ts --pool=threads --maxWorkers=1` → **1 passed**. `NODE_OPTIONS=--trace-warnings npx vitest run tests/component/jsdom-storage.test.ts tests/integration/node-worker-thread.test.ts --maxWorkers=1 -t 'provides JSDOM storage|returns a typed initialization failure|surfaces cleanup failure'` → **3 passed, 5 skipped**. Existing flags remain usable; nested Worker typed-init/error cleanup runs intact.
- V4. **Stale fixtures red:** `npx vitest run tests/component/story/cancel-controls.test.ts tests/component/deck-editor/editor-import.test.ts --maxWorkers=1` → **2 failed, 14 passed**. Exact errors: `TypeError: Cannot read properties of null (reading 'click')`; `AssertionError: expected false to be true // Object.is equality`.
- V5. **Stale fixtures green:** `npx vitest run tests/component/story/cancel-controls.test.ts tests/component/story/TitleAndLoad.test.ts tests/component/deck-editor/editor-import.test.ts tests/component/deck-editor/owned-only-catalog.test.ts --maxWorkers=1` → **26 passed**.
- V6. **Full focused Node suites:** `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts tests/asset-delivery-bundle.test.ts` → **64 passed, 0 failed**, duration `301309.551019ms`. Includes positive `rewriteManifest` predecessor control. Post-run owned producer/publisher roots: **0**.
- V7. **Scoped types:** `npx tsc --noEmit -p .tmp/test-harness-evidence-Nk9hFN/tsconfig.scoped.json` → exit **0**. Scratch config extended root `tsconfig.json`; included seven changed TS files, `src/**/*.d.ts`, transitive imports. Scratch removed after evidence capture.
- V8. **Whole-project types:** `npx tsc --noEmit` before repairs → exit **2**; after initial repairs → same baseline-only failure, byte-identical output: `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.` Temporary new control-test property typo caught by intermediate typecheck, corrected to `verified.candidate.previousManifestVersion`; scoped final check clean. Owner's unrelated TS repair not copied.
- V9. **Lint/format:** `npx eslint vitest.config.ts tests/progressive-producer.test.ts tests/progressive-publisher.test.ts tests/asset-delivery-bundle.test.ts tests/component/jsdom-storage.test.ts tests/component/story/cancel-controls.test.ts tests/component/deck-editor/editor-import.test.ts` → exit **0**. Same path list with `npx prettier --check` → `All matched files use Prettier code style!`. `git diff --check` → exit **0**.

- V10. **Selector red/green:** `npx vitest run tests/component/story/pre-battle-deck-picker.test.ts --maxWorkers=1 -t 'maps a link monster frame'` before selector fix → **1 failed, 24 skipped**, `AssertionError: expected null not to be null`. After fix, `npx vitest run tests/component/story/pre-battle-deck-picker.test.ts --maxWorkers=1` → **25 passed**. Prettier adjusted only changed selector wrapping; final check clean.
- V11. **Checkpoint red:** strengthened pre-outcome assertions against old empty checkpoint; `npx vitest run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1` → targeted cold-start test failed `AssertionError: expected 0 to be greater than 0`. Same run had three unrelated lazy-mount/cascade failures, **9 passed**. Initial targeted attempt timed out at `battle-root`; not counted as start-oracle proof. After occupied checkpoint fix, serial default full-file command → **13 passed**.
- V12. **Seed red:** after adding adversarial RNG spy, before oracle fix, `npx vitest run tests/component/StoryDuelHandoff.test.ts tests/unit/duel-worker-runtime.test.ts --maxWorkers=1 -t 'restarts the encounter from the checkpoint|keeps the opponent card list out'` → privacy assertion failed containing `22000`; emitted diagnostic seed was `["12200034567890123456","2","3","4"]`. Exact error: `AssertionError: expected '[{"type":"state","state":{"snapshotId…' not to contain '22000'`. Seed-only exclusion plus three leak controls → `npx vitest run tests/unit/duel-worker-runtime.test.ts --maxWorkers=1` **29 passed**.
- V13. **Cold-run limitation:** combined full handoff/runtime run under concurrent scoped TS/lint work → **41 passed, 1 failed** at unrelated first handoff `battle-root` 5s wait. Bounded serial retry: handoff **13 passed**, runtime **29 passed**. No timeout relaxation, async-sync shim, prod edit.
- V14. **Final ten-path scope:** `npx tsc --noEmit -p .tmp/test-harness-selector-LgZfUZ/tsconfig.scoped.json` → exit **0**, root config extended, all ten changed TS files plus ambient declarations/transitive imports included. Final ESLint/Prettier on C1–C10 → exit **0**; `git diff --check` clean.

## Owned-copy mutation/cleanup probes

Scratch driver commands: `python .tmp/test-harness-evidence-Nk9hFN/probe.py before`, then `python .tmp/test-harness-evidence-Nk9hFN/probe.py after`. Driver exited **0** both times; intentional child failures asserted, not ignored.

| ID | Probe | Before | After |
|---|---|---|---|
| P1 | Producer success | 2/2 roots remain | 0/2 remain |
| P2 | Producer setup failure | 1/1 remains | 0/1 remains |
| P3 | Producer assertion failure | 1/1 remains | 0/1 remains |
| P4 | Publisher success | 1/1 remains | 0/1 remains |
| P5 | Publisher setup failure | 1/1 remains | 0/1 remains |
| P6 | Publisher assertion failure | 1/1 remains | 0/1 remains |
| P7 | CRC signature checks disabled | 1 passed, false green | 1 failed, mutant killed |
| P8 | CRC production control | 1 passed | 1 passed |
| P9 | Inventory roster equality disabled | 1 passed, false green | 1 failed, mutant killed |
| P10 | MIME production control | 1 passed | 1 passed |

- P11. Cleanup probe copied suites into owned disposable repo; rerouted only fixture `mkdtemp` prefix into exact-owned probe parent; recorded created roots. Setup failure injected before `contentRuntimeFixture()`; assertion failure injected after caller received fixture/candidates. Child exit codes: success **0**, intentional failures **1**. Every scenario preserved neighboring sentinel bytes. Only recorded owned roots cleaned after red runs.
- P12. CRC mutation replaced both `checkSignature: true` occurrences with `false` **only in copied** `scripts/lib/asset-delivery/verify-archive.ts`; ZIP structure/file SHA guards stayed active. Ran `node --test --test-name-pattern='CRC faults' tests/asset-delivery-bundle.test.ts` in disposable cwd. Repaired mutant reached CRC assertion: `AssertionError [ERR_ASSERTION]: Missing expected rejection.` Positive/SHA controls already passed.
- P13. MIME mutation removed only expected-manifest roster equality block **in copied** `scripts/lib/asset-delivery/progressive-producer.ts`; source hashes, semantic checks, validation envelope guard stayed active. Ran `node --test --test-name-pattern='inventory roster: forged MIME identity' tests/progressive-producer.test.ts`. Repaired mutant: `AssertionError [ERR_ASSERTION]: Missing expected rejection.` Restoring copied guard restored green.
- P14. Copied vendor SHA-256 inventory unchanged across probes. Original pinned vendor, real data never mutated. No pre-existing temp-prefix removal.

## Changed files

- C1. `tests/asset-delivery-bundle.test.ts`
- C2. `tests/progressive-producer.test.ts`
- C3. `tests/progressive-publisher.test.ts`
- C4. `vitest.config.ts`
- C5. `tests/component/jsdom-storage.test.ts` — new, intentionally unstaged.
- C6. `tests/component/story/cancel-controls.test.ts`
- C7. `tests/component/deck-editor/editor-import.test.ts`
- C8. `tests/component/story/pre-battle-deck-picker.test.ts`
- C9. `tests/component/StoryDuelHandoff.test.ts`
- C10. `tests/unit/duel-worker-runtime.test.ts`
- C11. `/home/aron/Projects/ascencio/artifacts/codebase-audit/test-harness-worker.md` — report.

## Assumptions

- A1. Task scope includes parent-approved sixth through tenth harness/test repairs; no product behavior changes authorized.
- A2. Ordinary Node test teardown covers assertion/setup failure; abrupt process kill/crash excluded.
- A3. Existing untracked `node_modules` symlink belongs workspace setup. Preserved byte-for-byte target; never staged.
- A4. `graphify query "producer publisher fixtures archive CRC vitest environment"` failed: `/bin/bash: line 1: graphify: command not found`. Direct source inspection substituted.

## Residual risks / environment

- R1. Whole-project TS remains blocked by old `unknown`→`Error` fixture mismatch, per V8. Parent owns fix; no duplicate edit.
- R2. Initial Vitest run with linked parent deps failed before collection: `Error: Cannot find module '/@fs/home/aron/Projects/ascencio/node_modules/@testing-library/svelte/src/vitest.js'`. Owned dependency copy under worktree `.tmp/` resolved isolation artifact without install/config workaround. All runtime evidence above used this copy. Original parent `node_modules` symlink restored afterward; isolated rerun with original external symlink may still hit unrelated module-resolution failure. Parent checkout uses normal local deps.
- R3. Full repository suites/browser builds not run. Node24 runtime not executed. Selected Node Worker tests only; unverified forced-exit behavior intentionally excluded, parent-owned.
- R4. Cleanup driver, logs, copied repo/deps, scoped TS config removed at `.tmp/test-harness-evidence-Nk9hFN`; own empty `.tmp/ship-t3-20260909/fixtures`, `.tmp/ship-t3-20260909`, `.tmp` removed via `rmdir`. Second owned scratch/deps/config/log tree `.tmp/test-harness-selector-LgZfUZ` removed after appended fixes; original dependency symlink restored again. No prior temp roots deleted. Deliverable retained.
- R5. No deps install, stage, commit, subagents, package/lock/CI edits. Final staged list empty. Existing untracked `node_modules` preserved; no clean-worktree claim.

- R6. Existing 5s lazy-mount waits can fail under cold transform/parallel-check load (V13). Serial default suites passed. Fresh reviewer should run handoff serially; investigate async-import synchronization separately if reproducible. No timeout change made.
- R7. Shared `tests/component/story/pre-battle-deck-picker.test.ts` overlaps separate UI-worker Archive-label additions. This diff touches only two old selectors; preserve independent additions during parent merge.

## Next action

- N1. Fresh reviewer: review C1–C10; rerun V2/V5/V6/V10–V12 with local deps. Resolve R1 separately before whole-repo gate. No remaining in-scope blocker.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1–F10 name severity, exact paths, fixes; V1–V14 and P1–P14 record executed red/green/mutation/cleanup evidence."
    }
  ],
  "changedFiles": [
    "tests/asset-delivery-bundle.test.ts",
    "tests/progressive-producer.test.ts",
    "tests/progressive-publisher.test.ts",
    "vitest.config.ts",
    "tests/component/jsdom-storage.test.ts",
    "tests/component/story/cancel-controls.test.ts",
    "tests/component/deck-editor/editor-import.test.ts",
    "tests/component/story/pre-battle-deck-picker.test.ts",
    "tests/component/StoryDuelHandoff.test.ts",
    "tests/unit/duel-worker-runtime.test.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/asset-delivery-bundle.test.ts",
    "tests/progressive-producer.test.ts",
    "tests/progressive-publisher.test.ts",
    "tests/component/jsdom-storage.test.ts",
    "tests/component/story/cancel-controls.test.ts",
    "tests/component/deck-editor/editor-import.test.ts",
    "tests/component/story/pre-battle-deck-picker.test.ts",
    "tests/component/StoryDuelHandoff.test.ts",
    "tests/unit/duel-worker-runtime.test.ts"
  ],
  "commandsRun": [
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts tests/asset-delivery-bundle.test.ts",
      "result": "passed",
      "summary": "64 passed; 0 failed."
    },
    {
      "command": "npx vitest run tests/component/BattleFacade.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "19 passed, no manual env flags."
    },
    {
      "command": "env -u NODE_OPTIONS npx vitest run tests/component/jsdom-storage.test.ts tests/component/BattleFacade.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "Before config fix 20 failed; after fix 20 passed."
    },
    {
      "command": "npx vitest run tests/component/story/cancel-controls.test.ts tests/component/story/TitleAndLoad.test.ts tests/component/deck-editor/editor-import.test.ts tests/component/deck-editor/owned-only-catalog.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "26 passed; both stale assertions independently reproduced red first."
    },
    {
      "command": "python .tmp/test-harness-evidence-Nk9hFN/probe.py before; python .tmp/test-harness-evidence-Nk9hFN/probe.py after",
      "result": "passed",
      "summary": "Owned-copy driver verified two killed mutants, restored controls, six cleanup paths, preserved sentinels; scratch removed."
    },
    {
      "command": "env -u NODE_OPTIONS npx vitest run tests/component/jsdom-storage.test.ts --pool=threads --maxWorkers=1",
      "result": "passed",
      "summary": "1 passed."
    },
    {
      "command": "NODE_OPTIONS=--trace-warnings npx vitest run tests/component/jsdom-storage.test.ts tests/integration/node-worker-thread.test.ts --maxWorkers=1 -t 'provides JSDOM storage|returns a typed initialization failure|surfaces cleanup failure'",
      "result": "passed",
      "summary": "3 passed, 5 intentionally skipped."
    },
    {
      "command": "npx tsc --noEmit -p .tmp/test-harness-evidence-Nk9hFN/tsconfig.scoped.json",
      "result": "passed",
      "summary": "Seven changed TS paths, ambient declarations, transitive imports; config removed after validation."
    },
    {
      "command": "npx tsc --noEmit",
      "result": "failed",
      "summary": "Pre-existing tests/fixtures/node-duel-worker-harness.ts(96,33) TS2345 only; baseline output unchanged."
    },
    {
      "command": "npx eslint vitest.config.ts tests/progressive-producer.test.ts tests/progressive-publisher.test.ts tests/asset-delivery-bundle.test.ts tests/component/jsdom-storage.test.ts tests/component/story/cancel-controls.test.ts tests/component/deck-editor/editor-import.test.ts tests/component/story/pre-battle-deck-picker.test.ts tests/component/StoryDuelHandoff.test.ts tests/unit/duel-worker-runtime.test.ts",
      "result": "passed",
      "summary": "Exit 0."
    },
    {
      "command": "npx prettier --check vitest.config.ts tests/progressive-producer.test.ts tests/progressive-publisher.test.ts tests/asset-delivery-bundle.test.ts tests/component/jsdom-storage.test.ts tests/component/story/cancel-controls.test.ts tests/component/deck-editor/editor-import.test.ts tests/component/story/pre-battle-deck-picker.test.ts tests/component/StoryDuelHandoff.test.ts tests/unit/duel-worker-runtime.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "git diff --check; git diff --cached --name-only",
      "result": "passed",
      "summary": "No whitespace errors; staged list empty."
    },
    {
      "command": "npx vitest run tests/component/story/pre-battle-deck-picker.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "25 passed; targeted old selector red first."
    },
    {
      "command": "npx vitest run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "13 passed on serial retry; empty checkpoint red proved starts=0 before fixture fix."
    },
    {
      "command": "npx vitest run tests/unit/duel-worker-runtime.test.ts --maxWorkers=1",
      "result": "passed",
      "summary": "29 passed; colliding seed passes; injected ordinary event/trace metadata/entry identities rejected."
    },
    {
      "command": "npx vitest run tests/component/StoryDuelHandoff.test.ts tests/unit/duel-worker-runtime.test.ts --maxWorkers=1",
      "result": "failed",
      "summary": "41 passed, unrelated first handoff lazy-mount wait failed under cold/concurrent load; serial full-file retries passed."
    },
    {
      "command": "npx tsc --noEmit -p .tmp/test-harness-selector-LgZfUZ/tsconfig.scoped.json",
      "result": "passed",
      "summary": "All ten changed TS files plus ambient declarations/transitive imports; no diagnostics."
    }
  ],
  "validationOutput": [
    "E1. Legacy focused suites 64/64; default facade 19/19; storage+facade 20/20; stale-fixture guard suites 26/26.",
    "E2. CRC/MIME mutants: old false green; fixed assertions fail with Missing expected rejection.; restored guards pass.",
    "E3. Six cleanup probes: zero owned roots after fixes; sentinels retained.",
    "E4. Scoped types/lint/format clean; whole-project TS baseline remains.",
    "E5. Final selector suite 25/25; checkpoint handoff 13/13; Worker runtime 29/29.",
    "E6. Seed-only exclusion retains three explicit negative privacy controls; production RNG untouched.",
    "E7. Ten-path scoped TS/lint/format clean."
  ],
  "residualRisks": [
    "R1. Pre-existing TS2345 at tests/fixtures/node-duel-worker-harness.ts:96; parent-owned.",
    "R2. External node_modules symlink causes worktree-only Vitest setup resolution failure; owned local copy used for runtime proof, original symlink restored.",
    "R3. Full repo/browser/Node24 execution excluded; forced-exit note deferred to parent.",
    "R4. Cold/concurrent handoff lazy-mount timeout observed; serial default full suite passed. No timeout relaxation.",
    "R5. Parent must preserve separate UI-worker Archive-label additions when merging pre-battle-deck-picker.test.ts."
  ],
  "noStagedFiles": true,
  "diffSummary": "Ten scoped harness/test files changed; exact-owned cleanup, CRC/MIME oracles, Node26 runner env, storage regression, three stale component fixtures/selectors, fieldable checkpoint/start proof, seed-aware privacy oracle. No production edits.",
  "reviewFindings": [
    "F1. Fixed P2 publisher leak: tests/progressive-publisher.test.ts:26.",
    "F2. Fixed P3 producer leak: tests/progressive-producer.test.ts:35.",
    "F3. Fixed P3 CRC false green: tests/asset-delivery-bundle.test.ts:624.",
    "F4. Fixed P2 MIME envelope false green: tests/progressive-producer.test.ts:484.",
    "F5. Fixed P2 Node26 storage shadow: vitest.config.ts:10; tests/component/jsdom-storage.test.ts:5.",
    "F6. Fixed P2 empty-slot fixture: tests/component/story/cancel-controls.test.ts:184.",
    "F7. Fixed P2 stale unavailable-card assertion: tests/component/deck-editor/editor-import.test.ts:168.",
    "F8. Fixed P2 stale decklist selectors: tests/component/story/pre-battle-deck-picker.test.ts:154.",
    "F9. Fixed P3 empty checkpoint/start false green: tests/component/StoryDuelHandoff.test.ts:452.",
    "F10. Fixed P2 diagnostic seed false red: tests/unit/duel-worker-runtime.test.ts:955.",
    "F11. No remaining in-scope blocker; fresh review pending."
  ],
  "manualNotes": "No installs, stage, commit, subagents. Original node_modules symlink restored. Exact-owned scratch removed. Production guards/vendor/data untouched."
}
```
