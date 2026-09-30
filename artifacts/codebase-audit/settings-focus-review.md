# Settings focus review — approved

## Review

- R1. **Done — scoped approval; no blockers.** Independent Settings run: **10/10 tests**. Native Chromium: **2/2 cases**, first attempt, port **4529**. Scoped ESLint/Prettier/diff checks pass. No reviewer source/test edits needed.
- R2. **Correct — P2 regression addressed.** `src/battle/app/App.svelte:246–248,690–694,1388` confirms accepted diagnostics req → pending → null callback. `src/battle/app/components/SettingsDialog.svelte:302–306` disables still-mounted Download button; no removal. Worker pre-fix BODY observation remains worker evidence; this review independently observes post-fix INPUT focus in both native portal modes (`tests/settings-focus.chromium.mjs:40–55`).
- R3. **Correct — fallback + observer.** `src/battle/app/components/SettingsDialog.svelte:66–106`: remembered target requires connected, panel-contained, enabled state; fallback selects first enabled control. Panel descendant `childList` + `disabled` attr observation covers removal/disable. Observer restores only outside/disabled active focus → valid focus retained. Re-enable preservation verified by `tests/component/SettingsDialog.test.ts:74–117`; removal fallback by `:118–136`. Native dynamic prompt case retains focused workspace checkbox (`tests/settings-focus.chromium.mjs:70–88`).
- R4. **Correct — lifecycle preserved.** Existing ancestor observation, owned-inert cleanup, listener removal, observer disconnect, trigger restore unchanged (`src/battle/app/components/SettingsDialog.svelte:107–123`). Passing component cases verify pre-existing inert ownership, post-unmount focus/observer behavior (`tests/component/SettingsDialog.test.ts:27–73`). Native cases verify dynamic workspace/prompt isolation, later-portal Close hit-testing, trigger restore, prompt usability after teardown (`tests/settings-focus.chromium.mjs:70–100`).
- R5. **Correct — no prior UI/Archive/Chain/E2E drift.** Current SHA-256 matches worker after-manifest for **22/22 paths** before/after checks; native runner hash unchanged during review. Before/after worker manifests differ only at three permitted existing paths. Reversing `settings-focus-evidence/incremental.diff` in memory independently recovers exact pre-worker hashes for all three → previous Settings source/tests/fixture bytes preserved outside appended delta. Remaining 19 incoming paths byte-identical, including Archive, Chain, E2E, original Chromium runner.
- R6. **Fixed — none by reviewer.** No concrete remaining scoped defect found. Approval covers four-file incremental focus delta only; no integrated/full-suite acceptance claim.

## Incremental files reviewed

- F1. `src/battle/app/components/SettingsDialog.svelte:66–106` — focus recovery only.
- F2. `tests/component/SettingsDialog.test.ts:74–136` — three added component cases.
- F3. `tests/fixtures/UiHardeningHarness.svelte:23–24,197–199` — opt-in diagnostics pending transition; other modes unchanged.
- F4. `tests/settings-focus.chromium.mjs:1–116` — new two-case native runner, isolated strict port 4529.
- F5. Reviewer intentional write: `/home/aron/Projects/ascencio/artifacts/codebase-audit/settings-focus-review.md` only. No staging, commits, deps/config edits, subagents.

## Validation

- V1. Exact independent component cmd; exit 0, `Test Files 1 passed (1)`, `Tests 10 passed (10)`, duration 10.80s:

```bash
NODE_OPTIONS=--no-experimental-webstorage node --input-type=module <<'JS'
import { startVitest } from 'vitest/node';
const ctx = await startVitest('test', ['tests/component/SettingsDialog.test.ts'], {
  run: true, watch: false, cache: false, maxWorkers: 1, configLoader: 'native',
}, {
  cacheDir: '.tmp/settings-focus-review-vitest-cache',
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ['/home/aron/Projects/ascencio'] } },
});
await ctx.close();
JS
```

- V2. `node tests/settings-focus.chromium.mjs` → exit 0; no retry needed. Exact assertion output:

```text
After diagnostics portal=false: {"tag":"INPUT","cy":"settings-show-duel-hud-checkbox"}
PASS diagnostics focus recovery portal=false
After diagnostics portal=true: {"tag":"INPUT","cy":"settings-show-duel-hud-checkbox"}
PASS diagnostics focus recovery portal=true
```

- V3. Scoped checks below pass. Prettier: `All matched files use Prettier code style!`; staged output empty; port output header only. Port 4518 untouched.

```bash
node_modules/.bin/eslint src/battle/app/components/SettingsDialog.svelte tests/component/SettingsDialog.test.ts tests/fixtures/UiHardeningHarness.svelte tests/settings-focus.chromium.mjs
node_modules/.bin/prettier --check src/battle/app/components/SettingsDialog.svelte tests/component/SettingsDialog.test.ts tests/fixtures/UiHardeningHarness.svelte tests/settings-focus.chromium.mjs
git diff --check
git diff --cached --name-only
ss -ltn 'sport = :4529'
```

- V4. Read-only Python assertions against root `settings-focus-evidence/before-sha256.json`, `after-sha256.json`, `incremental.diff` pass: `Post-validation byte preservation: 22/22 manifest paths + native runner unchanged`; `Staged paths: 0`. Native runner SHA-256: `d009ef9ab3e4b3f1ec40f8a76af6537762441700e42fcf80180ed25dad449ad2`.

## Assumptions

- A1. Four-file worker delta defines scope. Required reports + `AGENTS.md` read first. Pre-fix reproduction accepted from worker evidence; no production rollback/red rerun during review.
- A2. Existing first-enabled-control DOM order remains fallback policy. Actual markup contains enabled fallback controls; hidden/inert descendants inside panel not introduced by this delta.
- A3. Graph-first attempt failed exactly `/bin/bash: line 1: graphify: command not found`; direct source trace substituted.

## Residual risks / next action

- N1. Earlier worker cold-start timeout remains unexplained; independent fresh-cache run passed both cases first attempt. No timeout increase, hidden retry, prod-defect claim.
- N2. Native fixture mounts actual Settings/CSS, models inspected App callback transition; no real worker diagnostics req executed. Full/perf/type/build/real-WASM suites intentionally skipped. Prior broader integration caveats remain parent-owned.
- N3. Generated caches retained: `.tmp/settings-focus-review-vitest-cache/`, `.tmp/settings-focus-vite-cache-818387/`. Reviewer shell restriction permits read-only inspection/test runs; available file tools lack deletion. Parent cleanup needed for these two review-owned caches. Prior `.tmp/chain-selectors-review-vitest-cache/`, `node_modules` symlink untouched. No paths removed.
- N4. Next action: parent integrates approved four-file delta, preserves prior UI/Archive/Chain/E2E hunks, runs separately owned acceptance gates. No scoped human decision needed. Reviewer writes stop after this report.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1–R6 cite source/test lines; P2 disabled-control focus fix approved. Independent 10/10 component tests, 2/2 native cases, scoped lint/format pass. No scoped blockers. N1–N3 record residual risks."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/settings-focus-review.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"Settings modal focus lifecycle disabled control observer native browser tests\"",
      "result": "failed",
      "summary": "graphify unavailable; direct inspection substituted"
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node --input-type=module; exact startVitest invocation in V1",
      "result": "passed",
      "summary": "SettingsDialog.test.ts: 10/10 tests"
    },
    {
      "command": "node tests/settings-focus.chromium.mjs",
      "result": "passed",
      "summary": "2/2 native cases; port 4529; first attempt"
    },
    {
      "command": "node_modules/.bin/eslint src/battle/app/components/SettingsDialog.svelte tests/component/SettingsDialog.test.ts tests/fixtures/UiHardeningHarness.svelte tests/settings-focus.chromium.mjs",
      "result": "passed",
      "summary": "Exit 0"
    },
    {
      "command": "node_modules/.bin/prettier --check src/battle/app/components/SettingsDialog.svelte tests/component/SettingsDialog.test.ts tests/fixtures/UiHardeningHarness.svelte tests/settings-focus.chromium.mjs",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "git diff --check; git diff --cached --name-only; ss -ltn 'sport = :4529'",
      "result": "passed",
      "summary": "Whitespace clean; zero staged paths; port released"
    },
    {
      "command": "Read-only Python SHA-256 + inverse incremental-diff assertions described in V4",
      "result": "passed",
      "summary": "22/22 manifest paths + native runner preserved; three inverse hunks recover pre-worker hashes"
    }
  ],
  "validationOutput": [
    "Test Files 1 passed (1); Tests 10 passed (10)",
    "PASS diagnostics focus recovery portal=false",
    "PASS diagnostics focus recovery portal=true",
    "Post-validation byte preservation: 22/22 manifest paths + native runner unchanged",
    "Staged paths: 0"
  ],
  "residualRisks": [
    "Earlier worker cold-start timeout unexplained; independent run passes first attempt",
    "Fixture models App callback transition; real worker diagnostics/full/perf/type/build/E2E not executed",
    "Review-owned generated caches retained per N3; parent cleanup needed"
  ],
  "noStagedFiles": true,
  "diffSummary": "No reviewer source/test edits. Approved four-file focus delta; prior UI/Archive/Chain/E2E bytes preserved.",
  "reviewFindings": [
    "No scoped blockers",
    "P2 addressed: src/battle/app/components/SettingsDialog.svelte:66–106 recovers disabled/removed control focus without stealing valid focus",
    "Correct: src/battle/app/components/SettingsDialog.svelte:107–123 preserves isolation cleanup + trigger restore",
    "Correct: tests/component/SettingsDialog.test.ts:74–136 covers disable, re-enable, removal; tests/settings-focus.chromium.mjs:40–100 verifies native lifecycle"
  ],
  "manualNotes": "Scoped approval complete. Report sole intentional write. No staged files, commits, deps edits, subagents, timeout changes. Parent owns integration acceptance/cache cleanup. Writes stopped."
}
```
