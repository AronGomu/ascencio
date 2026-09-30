# ChainStatus selector review — approved

## Review

- R1. **Correct — scoped approval; no blockers.** `src/battle/app/components/duel-field/ChainStatus.svelte:18–35`: four repeated descendant `data-cy` attrs suffix `${link.index}`, matching existing keyed identity. Diff changes attrs/formatting only; no props, behavior, legality, hidden-data changes. Sole mount: `src/battle/app/components/duel-field/DuelHud.svelte:263`.
- R2. **Correct — mounted regression closes prior gap.** `tests/component/DuelHud.test.ts:19–76` mounts actual HUD, retains player/card/counter/material checks, adds descriptions to both fixture links, checks every mounted `[data-cy]` without filtering, verifies four descendant texts per link, compares selector sets after chain/card reorder. Fixture indexes 1/2: `tests/fixtures/board-public-states.ts:213–233`. Independent focused run: **40/40 tests pass**, including five DuelHud cases plus 35 selector-coverage cases.
- R3. **Correct — no stale selector refs.** Source/test/E2E scan finds zero unsuffixed `chain-status-link-provenance`, `chain-status-link-label`, `chain-status-link-state`, `chain-status-link-description` refs. Existing tests consume semantic chain text (`tests/component/DuelHud.test.ts:91–96`); new indexed lookup at line 58 matches production attrs.
- R4. **Correct — byte preservation during review.** SHA-256 aggregate before/after identical across all 22 incoming UI files: `829b17e69fc92c4e432404818148419bb46f4066b7e98576519c225d2fb7c4f9`. This covers prior 21-file approved UI delta plus ChainStatus. No review source/test fixes needed. All pre-existing DuelHud tests from current line 78 onward independently byte-identical to HEAD. Prior worker attests 20/21 approved files unchanged across its implementation; sole exception first DuelHud regression (`/home/aron/Projects/ascencio/artifacts/codebase-audit/chain-selectors-worker.md:9`). Archive/E2E preservation included.
- R5. **Fixed — none.** Concrete scoped defects: none found. No staging, commits, deps edits, subagents, full/perf/browser/type suites.

## Assumptions

- A1. Requested acceptance is attested. Original pre-worker 21-file byte snapshot was removed (`chain-selectors-worker.md`, cleanup section); earlier 20/21 preservation relies on worker evidence, not independently reproducible historical comparison. Fresh review independently proves 22/22 preservation from its own entry state.
- A2. Stable chain identity remains existing `link.index`; projector assigns `message.chain_size` (`src/battle/worker/projection/DuelStateProjector.ts:1568–1570`). No new identity contract required.
- A3. Graph-first attempt failed exactly: `/bin/bash: line 1: graphify: command not found`. Direct inspection substituted.

## Validation

- V1. Focused tests, run from `/home/aron/Projects/ascencio/.tmp/codebase-audit-ui`; native cfg loader avoids scratch cfg file, isolated cache avoids shared acceptance-worker cache. Output: `Test Files  2 passed (2)`; `Tests  40 passed (40)`; duration 27.32s.

```bash
NODE_OPTIONS=--no-experimental-webstorage node --input-type=module <<'JS'
import { startVitest } from 'vitest/node';
const ctx = await startVitest('test', ['tests/component/DuelHud.test.ts', 'tests/unit/data-cy-coverage.test.ts'], {
  run: true,
  watch: false,
  cache: false,
  maxWorkers: 1,
  configLoader: 'native',
}, {
  cacheDir: '.tmp/chain-selectors-review-vitest-cache',
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ['/home/aron/Projects/ascencio'] } },
});
await ctx.close();
JS
```

- V2. Scoped checks below exit 0. Prettier: `All matched files use Prettier code style!`; staged output empty.

```bash
node_modules/.bin/eslint src/battle/app/components/duel-field/ChainStatus.svelte tests/component/DuelHud.test.ts
node_modules/.bin/prettier --check src/battle/app/components/duel-field/ChainStatus.svelte tests/component/DuelHud.test.ts
git diff --check
git diff --cached --name-only
```

- V3. Python assertions: SHA-256 over sorted incoming paths plus bytes before/after; existing DuelHud test-tail equality against `git show HEAD:tests/component/DuelHud.test.ts`; recursive `src/tests/e2e` source scan using `chain-status-link-(?:provenance|label|state|description)(?![-\w])`. Outputs: `Review byte preservation: 22/22 incoming UI files unchanged`; `DuelHud pre-existing test tail: byte-identical to HEAD`; `Stale unsuffixed selector refs: 0 in src/tests/e2e`; `Staged paths: 0`.

## Residual risks / files / next action

- N1. Full/perf/browser/type gates intentionally skipped during acceptance-worker timing. Prior integration caveats remain owned by parent (`ui-review.md:R5`); no integrated acceptance claim.
- N2. Historical byte proof limitation: A1. Scope approved on worker attestation plus fresh source inspection, focused tests, current-state preservation.
- N3. Deliverable only intentional file write: this report. Vitest generated isolated `.tmp/chain-selectors-review-vitest-cache/` despite `cache: false`; retained because review shell restriction permits read-only inspection/test runs, available edit tools lack deletion. Parent may remove this review-owned cache after integration. No other scratch created; no files removed.
- N4. Next action: parent integrates two-file selector delta, preserves earlier approved UI hunks, runs separately owned acceptance gates. No scoped human decision needed. Writes stop after report.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Approved two-file incremental selector scope. Findings R1–R5 cite source/test lines; no concrete scoped defects. Independent 40/40 tests, lint/format/diff checks pass; zero stale refs; 22/22 incoming files byte-preserved during review. Historical 20/21 preservation explicitly worker-attested."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/chain-selectors-review.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"ChainStatus selectors tests chain links\"",
      "result": "failed",
      "summary": "graphify unavailable; direct inspection substituted"
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node --input-type=module; startVitest invocation reproduced in V1",
      "result": "passed",
      "summary": "DuelHud.test.ts plus data-cy-coverage.test.ts: 40 tests, two files"
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
      "command": "Python SHA-256 preservation, HEAD test-tail comparison, stale-selector scan assertions described in V3",
      "result": "passed",
      "summary": "22/22 incoming files unchanged; existing DuelHud cases unchanged; zero stale refs"
    }
  ],
  "validationOutput": [
    "Test Files 2 passed (2); Tests 40 passed (40)",
    "Scoped ESLint exit 0; Prettier clean; git diff --check clean",
    "Review byte preservation: 22/22 incoming UI files unchanged",
    "Stale unsuffixed selector refs: 0 in src/tests/e2e",
    "Staged paths: 0"
  ],
  "residualRisks": [
    "Historical pre-worker 20/21 preservation relies on worker attestation; original snapshot removed",
    "Full/perf/browser/type gates intentionally skipped; previous integration caveats not revalidated",
    "Isolated generated Vitest cache retained at .tmp/chain-selectors-review-vitest-cache/; parent cleanup needed"
  ],
  "noStagedFiles": true,
  "diffSummary": "No review source/test edits. Approved incoming four stable-index ChainStatus attr changes plus first mounted DuelHud regression extension; prior UI delta untouched during review.",
  "reviewFindings": [
    "No scoped blockers or concrete defects found",
    "Correct: src/battle/app/components/duel-field/ChainStatus.svelte:18–35 uses existing stable link.index for four repeated descendants",
    "Correct: tests/component/DuelHud.test.ts:19–76 checks whole-HUD uniqueness with two described links plus reorder"
  ],
  "manualNotes": "Approved incremental scope only. Report is sole intentional write; generated isolated test cache noted. No source fixes, staging, commits, deps changes, subagents, full/perf suites. Writes complete."
}
```
