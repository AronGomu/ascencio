# Settings diagnostics focus — done; fresh review required

## Evidence / finding

- R1. **Confirmed reachable native focus loss before fix, both portal modes.** `settings-focus-evidence/chromium-red.log`: diagnostics activation → disabled button → `After diagnostics portal=false: {"tag":"BODY","cy":null}`; identical `portal=true`. Both assertions failed before production edit. Component red: three new failures, seven existing passes (`component-red.log`).
- R2. **Trace correction:** button becomes **disabled**, not removed. `src/battle/app/App.svelte:246–248,690–694,1388`: accepted diagnostics req sets `diagnosticPending`; availability becomes false; callback becomes null. `src/battle/app/components/SettingsDialog.svelte:302–306`: null callback sets `disabled`. Old observer watched ancestor child lists only; retained disabled `lastFocus` could not receive native focus. JSDOM instead retained disabled button as activeElement — native regression essential.
- R3. **Minimal fix:** `src/battle/app/components/SettingsDialog.svelte:66–106` validates remembered focus via `isConnected`, panel membership, enabled state; fallback selects first enabled button/input. Existing observer additionally watches panel descendants’ child lists + `disabled` attrs; restores only invalid focus. Existing ancestor observation, inert ownership, cleanup, trigger restoration unchanged (`:107–123`). No markup/style/API change.
- R4. **Green:** `component-green.log` → `Test Files 1 passed (1)`, `Tests 10 passed (10)`. `chromium-green.log` → two PASS; activeElement first enabled Settings input, both portal modes. Native checks also verify Tab/Shift+Tab wrapping, dynamic workspace/prompt isolation, later-portal Close hit-testing, trigger restore, prompt interaction after teardown.
- R5. **Preservation:** SHA-256 manifests `before-sha256.json`, `after-sha256.json`; `preservation.log` → 19/22 incoming approved UI files byte-identical. Three exceptions only: Settings source, Settings component regression, opt-in diagnostics fixture. Prior Settings tests byte-identical after removing new blocks. E2E, Archive, Chain, original Chromium runner byte-identical. `incremental.diff` isolates changes against entry snapshot, not HEAD.

## Incremental files

- F1. `src/battle/app/components/SettingsDialog.svelte` — lifecycle fix only, +29/-4 lines.
- F2. `tests/component/SettingsDialog.test.ts:74–136` — three new cases: enabled→disabled in both portal modes; focused-control removal. Re-enable does not steal valid focus. Removal case tests connected fallback, not asserted App behavior.
- F3. `tests/fixtures/UiHardeningHarness.svelte:23–24,197–199` — five-line opt-in `diagnostics` query scenario mirroring App pending→null transition. Existing fixture modes unchanged.
- F4. `tests/settings-focus.chromium.mjs` — new standalone focused native runner; two portal modes, strict isolated port 4529, process-local Vite cache, no external network.
- F5. Deliverables: this report; `settings-focus-evidence/` logs, hash manifests, incremental diff. No staging, commits, deps/config/vendor changes, subagents.

## Validation cmds

- V1. Component red/green executed with `NODE_OPTIONS=--no-experimental-webstorage node .tmp/settings-focus/run-component.mjs`. Scratch runner removed after checks. Exact repeatable equivalent from this worktree:

```bash
NODE_OPTIONS=--no-experimental-webstorage node --input-type=module <<'JS'
import { startVitest } from 'vitest/node';
const ctx = await startVitest('test', ['tests/component/SettingsDialog.test.ts'], {
  run: true,
  watch: false,
  cache: false,
  maxWorkers: 1,
  configLoader: 'native',
}, {
  cacheDir: '.tmp/settings-focus-vitest-cache',
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ['/home/aron/Projects/ascencio'] } },
});
await ctx.close();
JS
```

- V2. `node tests/settings-focus.chromium.mjs` → pre-fix two failures; final two PASS. Logs retained. Initial port choice failed exactly `Error: Port 4518 is already in use`; switched to verified-free 4529 without touching incumbent process. First post-fix run hit `locator.click: Timeout 30000ms exceeded.` waiting for `open-settings` in nonportal mode; portal mode passed. Unchanged manual rerun passed both. No timeout/retry budget changes. Evidence: `chromium-port-conflict.log`, `chromium-mount-timeout.log`, `chromium-green.log`.
- V3. `node_modules/.bin/eslint src/battle/app/components/SettingsDialog.svelte tests/component/SettingsDialog.test.ts tests/fixtures/UiHardeningHarness.svelte tests/settings-focus.chromium.mjs` → exit 0 (`lint.log`).
- V4. `node_modules/.bin/prettier --check src/battle/app/components/SettingsDialog.svelte tests/component/SettingsDialog.test.ts tests/fixtures/UiHardeningHarness.svelte tests/settings-focus.chromium.mjs` → `All matched files use Prettier code style!`. `git diff --check` → exit 0. `git diff --cached --name-only` → empty. `ss -ltn 'sport = :4529'` → header only (`final-checks.log`).
- V5. Python SHA-256 comparison asserted exact three changed incoming paths; removing new Settings test blocks recovered entry bytes; staged path assertion passed (`preservation.log`).

## Assumptions / scope

- A1. Read `AGENTS.md`, root `artifacts/codebase-audit/ui-review.md`, `chain-selectors-review.md`. Graph-first failed exactly `/bin/bash: line 1: graphify: command not found`; direct source trace substituted.
- A2. Existing first-enabled-control order defines fallback; no new product choice. Disabled attr observation required by inspected markup, replacing initial removal-only hypothesis.
- A3. Native fixture mounts actual Settings component/CSS; models inspected App callback transition. No real worker diagnostics req executed. Full App/real-WASM E2E, full suites, perf/build/type gates intentionally skipped during acceptance-worker bench.

## Risks / cleanup / next action

- N1. No unresolved scoped defect found. Fresh independent reviewer approval still required; parent owns broader acceptance.
- N2. Native fixture first-mount timeout remains unexplained; prior UI review also records startup timeout. Final unchanged rerun passed; retained intermediate log, no hidden retries.
- N3. Removed own scratch only: `.tmp/settings-focus/`, `.tmp/settings-focus-vitest-cache/`, `.tmp/settings-focus-vite-cache-791897/`, `.tmp/settings-focus-vite-cache-792560/`, `.tmp/settings-focus-vite-cache-796566/`, `.tmp/settings-focus-vite-cache-798946/`. `cleanup.log` records paths. Prior `.tmp/chain-selectors-review-vitest-cache/`, `node_modules` symlink untouched.
- N4. Next action: fresh reviewer inspects `settings-focus-evidence/incremental.diff` + four incremental paths; reruns V1–V4. Preserve all earlier E2E/Archive/Chain changes during integration.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Native pre-fix BODY focus reproduced in both portal modes. Minimal Settings connected/enabled fallback plus descendant childList/disabled observer; only four incremental source/test paths. 19/22 incoming files byte-identical; three permitted Settings/regression exceptions."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Retained red/green logs, incremental entry-state diff, before/after SHA-256 manifests, runnable focused regression, exact cmds. Fresh independent review remains required."
    }
  ],
  "changedFiles": [
    "src/battle/app/components/SettingsDialog.svelte",
    "tests/component/SettingsDialog.test.ts",
    "tests/fixtures/UiHardeningHarness.svelte",
    "tests/settings-focus.chromium.mjs"
  ],
  "testsAddedOrUpdated": [
    "tests/component/SettingsDialog.test.ts: three new cases",
    "tests/fixtures/UiHardeningHarness.svelte: opt-in diagnostics pending scenario",
    "tests/settings-focus.chromium.mjs: two native portal-mode cases"
  ],
  "commandsRun": [
    {
      "command": "graphify query \"SettingsDialog focus containment diagnostics availability lifecycle\"",
      "result": "failed",
      "summary": "graphify unavailable; direct inspection substituted"
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node .tmp/settings-focus/run-component.mjs (pre-fix)",
      "result": "failed",
      "summary": "Expected red: three new failures, seven existing passes"
    },
    {
      "command": "node tests/settings-focus.chromium.mjs (pre-fix)",
      "result": "failed",
      "summary": "Expected red: activeElement BODY in both portal modes; initial port conflict logged separately"
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node .tmp/settings-focus/run-component.mjs (post-fix; equivalent inline cmd V1)",
      "result": "passed",
      "summary": "10/10 Settings component tests"
    },
    {
      "command": "node tests/settings-focus.chromium.mjs (first post-fix run)",
      "result": "failed",
      "summary": "Nonportal fixture mount timeout; portal case passed; no focus regression observed"
    },
    {
      "command": "node tests/settings-focus.chromium.mjs (unchanged final rerun)",
      "result": "passed",
      "summary": "Two PASS: diagnostics focus recovery, Tab wrapping, dynamic isolation, trigger/portal cleanup"
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
      "summary": "Whitespace clean; zero staged paths; browser port released"
    },
    {
      "command": "Python entry SHA-256/current SHA-256 + existing Settings test-block preservation assertions",
      "result": "passed",
      "summary": "19/22 incoming files unchanged; exact three scoped exceptions; E2E/Archive/Chain unchanged"
    }
  ],
  "validationOutput": [
    "Pre-fix Chromium: After diagnostics portal=false: {\"tag\":\"BODY\",\"cy\":null}; portal=true identical",
    "Component red: 3 failed, 7 passed; green: 10 passed",
    "Final Chromium: PASS diagnostics focus recovery portal=false; PASS diagnostics focus recovery portal=true",
    "Staged paths: 0"
  ],
  "residualRisks": [
    "Fresh independent review required",
    "One intermediate native fixture mount timeout; unchanged final rerun passed",
    "No real worker diagnostics/E2E execution; full/perf/build/type suites intentionally skipped"
  ],
  "noStagedFiles": true,
  "diffSummary": "Settings lifecycle only: connected/enabled remembered focus guard, first-enabled fallback, panel childList/disabled mutation observation. Three new component cases, opt-in fixture state, focused native runner. Prior inert ownership/trigger restore/ancestor observation unchanged.",
  "reviewFindings": [
    "Confirmed P2: App diagnostics pending disables focused Settings button; native focus falls to BODY",
    "Initial removal hypothesis corrected by source inspection; disabled transition reproduced",
    "No known remaining scoped blocker; reviewer approval pending"
  ],
  "manualNotes": "Evidence under /home/aron/Projects/ascencio/artifacts/codebase-audit/settings-focus-evidence/. Own scratch removed; prior cache/symlink preserved. No staging/commit/config/deps/vendor/subagent/full/perf actions. Ready for NEW fresh review."
}
```
