# Independent Story review

State: **done — APPROVED after reviewer fixes**, scoped F1–F5. Integration gates remain parent-owned.

## Review

- R1 **Fixed · High/P1:** production save observer bypassed F4 cancellation. `sessionSaves` invoked global recovery before lookup completion reached route-token checks. Rejected/corrupt reads from abandoned Story decks redirected newer free-play route to Home; same defect affected Story collection, including post-unmount navigation. Evidence: reviewer deck regressions initially **2 failed**, collection matrix **6 failed / 2 passed**; exact failure: `AssertionError: expected 'home' to be 'free-play-decks' // Object.is equality`. Fix: capture raw session reads before lazy imports; route-owned completion decides recovery. Deck context retains observed writes. Locations: `src/shell/AppShell.svelte:371-381,632-660,723-736`; observer: `src/shell/core/session-saves.ts:8-24`. Regression matrix: `tests/component/deck-editor/editor-context.test.ts:184-269` — **16 passed**, error/corrupt × decks/collection × free-play-decks/direct free-play/unmount/still-active. Still-active fatal reads continue recovery.
- R2 **Correct:** internal editor return/browser Back resumes persisted beat, DP, collection, edited deck; fresh direct link remains fresh. Explicit New wins over inferred Continue. Evidence: `src/shell/shell-store.ts:61-70`; `tests/component/deck-editor/editor-context.test.ts:334-399`; `tests/component/StoryMenuEntry.test.ts:217-224,278-289`; `tests/unit/shell-store.test.ts:135-171`. Reviewer strengthened New test with existing saved map; added explicit-New/collection-return unit coverage.
- R3 **Correct:** typed quota failure stays retryable without Story teardown; fatal read/write policy remains. Evidence: `src/shell/core/session-saves.ts:15-19`; `tests/component/StoryMenuEntry.test.ts:121-179` verifies same mounted Story node, unchanged beat, no application clear, successful retry persisted at advanced beat. `tests/unit/shell/session-saves.test.ts:20-77` covers quota/unavailable/unknown/stale/corrupt/rejected I/O.
- R4 **Correct:** compatible hydrated slots control availability; empty/incompatible slots cannot fabricate progress. Manual deletion survives remount; autosave restores saved state. Evidence: `src/story/StoryApp.svelte:774-780,1044-1052`; `src/story/screens/LoadScreen.svelte:64-128`; `tests/component/StoryMenuEntry.test.ts:181-275`; `tests/component/story/TitleAndLoad.test.ts:17-68`.
- R5 **Correct:** mutation queue encloses lookup, CAS/duplicate checks, stamping, dispatch acceptance, persist, session-history updates. Create/save acceptance checks requested record identity. Delete/default checks serialize; refused writes restore state before next operation. Evidence: `src/story/decks/story-deck-repository.ts:122-137,165-199,228-236`; `tests/unit/story/story-deck-repository.test.ts:80-135,366-392,465-608`; focused repository/context tests passed.
- R6 **Blocker:** none remaining in reviewed patch scope. Isolated worktree typecheck remains blocked by unchanged fixture; not patch rejection. Exact diagnostic under V5.

## Independent validation

- V1 Read `AGENTS.md`, worker report, actual **12 tracked diffs**, new `tests/unit/shell/session-saves.test.ts`, surrounding route/session/save/reducer/context code. Initial independent worker-state run: **9 files / 177 tests passed**.
- V2 Reviewer red→green: deck production observer regressions **2 failed → 2 passed**, expanded deck matrix **8 passed**; collection production matrix **6 failed / 2 passed → combined 16 passed**. Initial harness expected two reads; production transient menu adds two probes. Corrected expectation before claiming production red. One over-specific test-name filter selected zero tests; reran broader filter before claiming evidence.
- V3 Final focused command below: **11 files / 246 tests passed**, 65.40s. Includes domain-boundary/data-cy contracts, production seams, shell/core-menu, repository rollback.
- V4 Final Prettier, ESLint, `git diff --check`: exit 0. `git diff --cached --name-only | wc -l`: **0**. No commits/staging/push. No tracked config/deps/vendor/other-domain changes.
- V5 `npm run typecheck`: exit 2, unchanged fixture only. `npx svelte-check --tsconfig ./tsconfig.json`: **1 error / 4 warnings**, same fixture; no changed-file diagnostics. `git diff -- tests/fixtures/node-duel-worker-harness.ts` empty; `git show HEAD:tests/fixtures/node-duel-worker-harness.ts` confirms unchanged callback. Root correction acknowledged by task, not independently applied here.

```bash
npx vitest run --config .tmp/vitest-story-review.config.ts --maxWorkers=2 tests/unit/story/story-deck-repository.test.ts tests/unit/story/story-deck-context.test.ts tests/unit/shell-store.test.ts tests/unit/shell/session-saves.test.ts tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts tests/component/story/TitleAndLoad.test.ts tests/component/AppShell.test.ts tests/component/core-menu.test.ts
npx prettier --check $(git diff --name-only) tests/unit/shell/session-saves.test.ts
npx eslint $(git diff --name-only) tests/unit/shell/session-saves.test.ts
git diff --check
git diff --cached --name-only | wc -l
npm run typecheck
npx svelte-check --tsconfig ./tsconfig.json
```

```text
Test Files  11 passed (11)
Tests  246 passed (246)
All matched files use Prettier code style!
format/lint exit=0
staged files=0
tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.
svelte-check found 1 error and 4 warnings in 4 files
```

## Old shop failure — independently settled

- S1 Default-timeout isolated run reproduced failure at `tests/component/story/StoryApp.test.ts:492`: `AssertionError: expected null not to be null`. DOM still `story-shop-pending` / `Opening the shop`. Test uses Testing Library default one-second wait around lazy shop import (`src/story/StoryApp.svelte:1156`). Not silently classified baseline-green.
- S2 Scratch-only `configure({ asyncUtilTimeout: 15_000 })` resolved unchanged test: **1 passed / 19 skipped**, test duration 4.47s. Whole unchanged `StoryApp.test.ts` then passed **20/20**, 4.63s test time. Evidence supports cold lazy-transform wait budget, not functional shop regression. No tracked shop/test timeout edits.

```bash
npx vitest run --config .tmp/vitest-story-review.config.ts --maxWorkers=1 tests/component/story/StoryApp.test.ts -t 're-enters a shop origin with a working leave route'
npx vitest run --config .tmp/vitest-story-review-shop.config.ts --maxWorkers=1 tests/component/story/StoryApp.test.ts -t 're-enters a shop origin with a working leave route'
npx vitest run --config .tmp/vitest-story-review-shop.config.ts --maxWorkers=1 tests/component/story/StoryApp.test.ts
```

## Scratch runner

`.tmp/vitest-story-review.config.ts`:

```ts
import config from "../vitest.config.ts";
import { defineConfig, mergeConfig } from "vitest/config";

export default defineConfig(mergeConfig(config, {
  cacheDir: ".tmp/vite-story-review-cache",
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ["/home/aron/Projects/ascencio"] } },
}));
```

`.tmp/vitest-story-review-shop.config.ts` imports preceding scratch config, merges separate `cacheDir: ".tmp/vite-story-review-shop-cache"`, adds `.tmp/story-review-shop-timeout.ts` setup. Setup calls Testing Library `configure({ asyncUtilTimeout: 15_000 })`.

## Files touched by reviewer

- F1 `src/shell/AppShell.svelte`: route-owned failure observation for deck/collection lookups; observed editor writes retained.
- F2 `tests/component/deck-editor/editor-context.test.ts`: 16-case production application lookup matrix.
- F3 `tests/component/StoryMenuEntry.test.ts`: seeded-save explicit New assertion.
- F4 `tests/unit/shell-store.test.ts`: 4 explicit-New/collection-return cases.
- F5 Scratch: `.tmp/vitest-story-review.config.ts`, `.tmp/vitest-story-review-shop.config.ts`, `.tmp/story-review-shop-timeout.ts`, `.tmp/vite-story-review-cache/`, `.tmp/vite-story-review-shop-cache/`.
- F6 Deliverable: `/home/aron/Projects/ascencio/artifacts/codebase-audit/story-review.md`.

Worker's other changes preserved; final source status remains 12 modified tracked files plus new session-save unit test. Pre-existing `node_modules` symlink preserved.

## Assumptions

- A1 Scope = worker F1–F5, directly related stale Story lookup seams. Collection shares same save observer defect → small same-file fix included after independent red reproduction.
- A2 Graph-first lookup attempted: `/bin/bash: line 1: graphify: command not found` → direct source inspection fallback.
- A3 Chromium/browser/full-build acceptance remains parent gate; component tests do not establish browser acceptance.

## Residual risks / exact next action

- Q1 Parent must integrate reviewer delta before approval applies; worker-only snapshot still fails production stale-lookup checks.
- Q2 Parent runs `npm run typecheck` on integrated root containing existing fixture correction. Isolated fixture left untouched; full typecheck not claimed green.
- Q3 Default shop test wait remains timing-fragile. Parent may adopt focused lazy-import wait budget separately; tracked test left unchanged. No full-suite/build/E2E claim.
- Q4 Scratch retained under ignored `.tmp/`: review tool policy allows read-only bash, no deletion tool supplied. No cleanup falsely claimed. Parent may remove exactly F5 paths after validation; retain F6 deliverable.
- Q5 First shop diagnostic shared reviewer cache with simultaneous one-worker deck check; both completed green. Subsequent whole-shop run used separate cache path, concurrent shell suite used main review cache. Parent/shared `node_modules` optimizer cache never used by these scratch configs.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1 identifies verified High/P1 production cancellation bypass at src/shell/AppShell.svelte:371,723; reviewer repaired both deck/collection paths. R2-R5 cite independently inspected behavior/tests. V3 reports final 246-test focused pass; residuals Q1-Q5 explicit."
    }
  ],
  "changedFiles": [
    "src/shell/AppShell.svelte",
    "tests/component/deck-editor/editor-context.test.ts",
    "tests/component/StoryMenuEntry.test.ts",
    "tests/unit/shell-store.test.ts",
    ".tmp/vitest-story-review.config.ts",
    ".tmp/vitest-story-review-shop.config.ts",
    ".tmp/story-review-shop-timeout.ts",
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/story-review.md"
  ],
  "testsAddedOrUpdated": [
    "tests/component/deck-editor/editor-context.test.ts: 16 production-path cases",
    "tests/component/StoryMenuEntry.test.ts: New starts fresh despite saved map",
    "tests/unit/shell-store.test.ts: 4 explicit-New/collection-return cases"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run --config .tmp/vitest-story-review.config.ts --maxWorkers=1 tests/component/deck-editor/editor-context.test.ts -t 'through the production session wrapper'",
      "result": "passed",
      "summary": "Initial deck red: 2 failed. Final combined deck/collection matrix: 16 passed, 15 skipped."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-story-review.config.ts --maxWorkers=1 tests/component/deck-editor/editor-context.test.ts -t 'story-collection'",
      "result": "failed",
      "summary": "Before reviewer collection fix: 6 failed, 2 passed, 23 skipped; stale read redirects newer route or navigates after teardown."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-story-review.config.ts --maxWorkers=2 tests/unit/story/story-deck-repository.test.ts tests/unit/story/story-deck-context.test.ts tests/unit/shell-store.test.ts tests/unit/shell/session-saves.test.ts tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts tests/component/story/TitleAndLoad.test.ts tests/component/AppShell.test.ts tests/component/core-menu.test.ts",
      "result": "passed",
      "summary": "Final 11 files, 246 tests passed."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-story-review.config.ts --maxWorkers=1 tests/component/story/StoryApp.test.ts -t 're-enters a shop origin with a working leave route'",
      "result": "failed",
      "summary": "Default one-second Testing Library wait expires during lazy shop import."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-story-review-shop.config.ts --maxWorkers=1 tests/component/story/StoryApp.test.ts",
      "result": "passed",
      "summary": "20 tests passed with scratch-only 15-second Testing Library wait; unchanged source/test."
    },
    {
      "command": "npx prettier --check $(git diff --name-only) tests/unit/shell/session-saves.test.ts && npx eslint $(git diff --name-only) tests/unit/shell/session-saves.test.ts",
      "result": "passed",
      "summary": "Final format/lint exit 0."
    },
    {
      "command": "npm run typecheck",
      "result": "failed",
      "summary": "Unchanged tests/fixtures/node-duel-worker-harness.ts:96 TS2345."
    },
    {
      "command": "npx svelte-check --tsconfig ./tsconfig.json",
      "result": "failed",
      "summary": "Same sole unchanged fixture error, 4 existing warnings; no changed-file diagnostics."
    },
    {
      "command": "git diff --check; git diff --cached --name-only | wc -l",
      "result": "passed",
      "summary": "No whitespace errors; 0 staged files."
    }
  ],
  "validationOutput": [
    "V1: Initial worker-state independent run: 177 tests passed.",
    "V2: Reviewer production deck red: 2 failed; collection red: 6 failed / 2 passed; combined green: 16 passed.",
    "V3: Final Test Files 11 passed (11); Tests 246 passed (246).",
    "V4: Unchanged whole StoryApp.test.ts: 20 passed with scratch-only lazy-import wait budget.",
    "V5: All matched files use Prettier code style! format/lint exit=0.",
    "V6: tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'."
  ],
  "residualRisks": [
    "Q1: Approval applies after reviewer delta integration, not worker-only snapshot.",
    "Q2: Integrated-root typecheck required; isolated unchanged fixture still fails.",
    "Q3: Default old shop test remains cold-import timing-fragile; scratch timeout settles functional path only.",
    "Q4: Browser/E2E/build/full-suite acceptance not claimed.",
    "Q5: F5 scratch retained because no permitted deletion tool; parent cleanup remains."
  ],
  "noStagedFiles": true,
  "diffSummary": "Worker F1-F5 approved after reviewer closes production session-observer cancellation bypass for Story deck/collection lookups; adds 20 cases, strengthens New regression. No additional production files, config/deps/vendor/domain changes.",
  "reviewFindings": [
    "R1 Fixed High/P1: src/shell/AppShell.svelte:371-381,723-736 - stale read recovery bypassed route tokens through globally observed saves.",
    "R2 Correct: resume/New/direct-entry, quota retry, empty/incompatible slots, serialized mutation rollback independently verified.",
    "R3 No remaining in-scope patch blockers; known isolated fixture gate remains."
  ],
  "manualNotes": "APPROVED after reviewer fixes. Parent owns integration/gates. No staging, commits, push, subagents, unrelated cleanup. No further writes after this report."
}
```
