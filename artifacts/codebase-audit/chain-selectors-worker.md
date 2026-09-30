# ChainStatus selector regression — done

## Evidence / incremental scope

- E1. Red: mounted DuelHud with two described chain links → `AssertionError: expected 116 to be 120 // Object.is equality` at `tests/component/DuelHud.test.ts:48`. Four duplicate descendants reproduced; remaining four tests passed.
- E2. Green: same focused cmd → `Test Files  1 passed (1)`; `Tests  5 passed (5)`. Scoped ESLint exit 0; Prettier `All matched files use Prettier code style!`; `git diff --check` exit 0; staged paths empty.
- E3. `src/battle/app/components/duel-field/ChainStatus.svelte:22–35`: provenance, label, state, description selectors now suffix `${link.index}`. Existing keyed loop uses same identity at line 18. Four attr changes plus required wrapping; source diff 10 insertions, 4 deletions. No prefix prop/API added. Sole callsite remains `src/battle/app/components/duel-field/DuelHud.svelte:263`.
- E4. `tests/component/DuelHud.test.ts:19–76`: existing mounted uniqueness regression extended, not replaced. Removed debt-masking `chain: []` override; fixture's two links now each receive description. Assert whole mounted selector uniqueness, four descendant selectors' text per link, stable selector set after link/card reorder. Existing player/card/counter/material checks retained. No selector filtering remains in regression.
- E5. Before/after SHA-256 comparison across all 21 incoming reviewed UI files → `Baseline byte check: 20/21 reviewed UI files byte-identical; sole scoped exception: tests/component/DuelHud.test.ts`. Incremental comparison for exception shows only E4 inside first regression. All later DuelHud cases byte-identical. Archive/e2e hunks preserved byte-identical. No earlier reviewed source file changed.

## Assumptions

- A1. Parent-confirmed prior reviewer completion authorizes sole-writer work. Existing 21-file delta treated as immutable except explicit DuelHud regression extension.
- A2. Existing keyed `link.index` defines stable chain identity; no alternate identity/API introduced (`ChainStatus.svelte:18`).
- A3. Graph query unavailable: `/bin/bash: line 1: graphify: command not found`. Direct source inspection substituted.
- A4. Symlinked deps require isolated scratch Vitest cfg, matching prior review strategy. No tracked cfg/deps edits. Initial run lacked fs allow entry → `Error: Cannot find module '/@fs/home/aron/Projects/ascencio/node_modules/@testing-library/svelte/src/vitest.js'`; zero tests ran. Added scratch-only fs allow → behavioral red/green verified.

## Commands / reproduction

Run cwd: `/home/aron/Projects/ascencio/.tmp/codebase-audit-ui`.

Scratch `.tmp/chain-selectors-vitest.config.ts` used for red/green, removed afterward:

```ts
import { mergeConfig } from "vitest/config";
import config from "../vitest.config.ts";

export default mergeConfig(config, {
  cacheDir: ".tmp/chain-selectors-vitest-cache",
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ["/home/aron/Projects/ascencio"] } },
});
```

```bash
NODE_OPTIONS=--no-experimental-webstorage node_modules/.bin/vitest run --config .tmp/chain-selectors-vitest.config.ts tests/component/DuelHud.test.ts
node_modules/.bin/eslint src/battle/app/components/duel-field/ChainStatus.svelte tests/component/DuelHud.test.ts
node_modules/.bin/prettier --check src/battle/app/components/duel-field/ChainStatus.svelte tests/component/DuelHud.test.ts
git diff --check
git diff --cached --name-only
```

## Residual risks / cleanup / next action

- R1. Fresh independent review required. No unresolved scoped blocker found. No fullsuite/perf/browser/type gates run, per assigned scope. Prior integrated type-gate caveat remains in `ui-review.md:R5`; not revalidated here.
- R2. Removed own scratch paths after reading: `.tmp/chain-selectors-baseline.json`, `.tmp/chain-selectors-DuelHud.before.ts`, `.tmp/chain-selectors-vitest.config.ts`, `.tmp/chain-selectors-vitest-cache/`. Pre-existing deps symlink untouched. No staging/commits/vendor/config changes retained.
- R3. Next action: fresh reviewer inspects two-file incremental change, recreates scratch cfg above, reruns focused commands. Parent retains existing approved UI delta during integration.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Only ChainStatus.svelte plus first mounted DuelHud regression changed. Four link.index suffixes; two described links; debt-masking empty-chain override removed. 20/21 incoming UI files byte-identical; scoped exception retains every unrelated test byte."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Behavioral red reproduces four duplicate selectors (116 unique / 120 total); green passes 5/5 tests. Exact focused commands, scratch cfg, source refs, preservation check, lint/format/staging evidence supplied. Fresh review pending."
    }
  ],
  "changedFiles": [
    "src/battle/app/components/duel-field/ChainStatus.svelte",
    "tests/component/DuelHud.test.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/component/DuelHud.test.ts:19 — mounted repeated-detail selector uniqueness now includes two described chain links plus reorder"
  ],
  "commandsRun": [
    {
      "command": "graphify query \"ChainStatus DuelHud data-cy uniqueness regression\"",
      "result": "failed",
      "summary": "graphify unavailable; direct inspection substituted"
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node_modules/.bin/vitest run --config .tmp/chain-selectors-vitest.config.ts tests/component/DuelHud.test.ts",
      "result": "failed",
      "summary": "Initial harness attempt: symlinked setup module inaccessible; zero tests. Scratch fs allow corrected."
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node_modules/.bin/vitest run --config .tmp/chain-selectors-vitest.config.ts tests/component/DuelHud.test.ts",
      "result": "failed",
      "summary": "Expected behavioral red: 1 failed, 4 passed; AssertionError: expected 116 to be 120 // Object.is equality"
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node_modules/.bin/vitest run --config .tmp/chain-selectors-vitest.config.ts tests/component/DuelHud.test.ts",
      "result": "passed",
      "summary": "Green: 5 passed; 1 test file"
    },
    {
      "command": "node_modules/.bin/eslint src/battle/app/components/duel-field/ChainStatus.svelte tests/component/DuelHud.test.ts",
      "result": "passed",
      "summary": "Exit 0"
    },
    {
      "command": "node_modules/.bin/prettier --check src/battle/app/components/duel-field/ChainStatus.svelte tests/component/DuelHud.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "git diff --check; git diff --cached --name-only",
      "result": "passed",
      "summary": "No whitespace errors; zero staged paths"
    },
    {
      "command": "Python hashlib.sha256 before/after comparison over incoming git diff paths plus untracked UI files; difflib.unified_diff scoped test comparison",
      "result": "passed",
      "summary": "20/21 incoming files byte-identical; sole exception contains only approved regression extension"
    }
  ],
  "validationOutput": [
    "Red: AssertionError: expected 116 to be 120 // Object.is equality",
    "Green: Test Files 1 passed (1); Tests 5 passed (5)",
    "Scoped ESLint: exit 0",
    "All matched files use Prettier code style!",
    "Staged files: 0"
  ],
  "residualRisks": [
    "Fresh independent review pending",
    "Fullsuite/perf/browser/type gates intentionally not run; prior integration caveats unchanged"
  ],
  "noStagedFiles": true,
  "diffSummary": "Four repeated descendant data-cy attrs gain stable link.index suffixes. Existing mounted DuelHud regression removes empty-chain bypass, checks two described links, verifies selector identity across reorder. Prior UI/Archive/e2e changes preserved.",
  "reviewFindings": [
    "No scoped blocker found; independent review required"
  ],
  "manualNotes": "Scratch cfg/cache/baseline removed. Reproduction cfg included above. No tracked cfg/deps/vendor edits, staging, commits, subagents, fullsuite/perf runs."
}
```
