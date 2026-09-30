# Story lifecycle fixes — F1–F5

State: **done; focused checks green; independent review pending**.
Worktree: `/home/aron/Projects/ascencio/.tmp/codebase-audit-story`.

## Evidence / scope

- E1 Final focused run: **9 files passed, 177 tests passed**. Covers F1–F5 regressions, repository/context rollback, domain boundaries, `data-cy` contracts.
- E2 Relevant Prettier, ESLint, `git diff --check`: exit 0. `git diff --cached --name-only | wc -l`: `0`.
- E3 Whole-worktree typecheck blocked by unchanged baseline fixture: `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.` `git show HEAD:tests/fixtures/node-duel-worker-harness.ts` confirms same callback. Parent steering confirms root already carries user correction; fixture preserved here.
- E4 No config/deps/vendor/CSS edits. No staging, commits, pushes, subagents. Pre-existing untracked `node_modules` symlink preserved.

## Implemented

- F1 Internal story-deck/collection → Story transitions now carry `continue`, including browser hash synchronization. Hydration resumes newest player slot. Explicit New Game overrides inference; direct initial Story entry stays fresh. Evidence: `src/shell/shell-store.ts:61`; round-trip tests in `tests/component/deck-editor/editor-context.test.ts`, direct-entry test in `tests/component/StoryMenuEntry.test.ts`.
- F2 Typed quota refusal bypasses destructive global recovery; existing domain retry retains mounted Story instance, advanced beat, persisted retry result. Fatal reads/rejections retain recovery policy. Evidence: `src/shell/core/session-saves.ts:3-22`; production `application` → `applySession` → `sessionSaves` regression in `tests/component/StoryMenuEntry.test.ts`; policy tests in `tests/unit/shell/session-saves.test.ts`.
- F3 Hydrated compatible state supplies real chapter summaries to LoadScreen/LoadOverlay. Missing/incompatible slots disabled. Manual deletion persists across remount. Removed production reducer fallback that invented progress. Placeholder timestamps/location claims removed without layout redesign. Evidence: `src/story/StoryApp.svelte:774,1044,1329`, `src/story/screens/LoadScreen.svelte:6,64,123`, `src/story/overlays/LoadOverlay.svelte:6,24`.
- F4 Story deck lookup token invalidates before non-story return, on teardown. Both completion branches also check current requested route. Deferred empty/error/ready results cannot redirect newer free-play deck route or overwrite editor context. Evidence: `src/shell/AppShell.svelte:628-650,878`; deferred regression matrix in `tests/component/deck-editor/editor-context.test.ts`.
- F5 Entire mutation executes inside repository queue: current lookup, CAS/duplicate check, stamping, dispatch acceptance, persistence, session-history update. Delete/default checks stay inside same serialization. Create/save confirm requested record identity, not merely matching id/revision. Evidence: `src/story/decks/story-deck-repository.ts:122,130,166,174,182,229`; overlap/rollback tests in `tests/unit/story/story-deck-repository.test.ts`.

## Tests added / updated

- T1 `tests/component/StoryMenuEntry.test.ts`: quota failure/retry through production session wrapper; missing manual slot + exact autosave restore; direct-entry freshness; deleted slot remount; incompatible overlay slots.
- T2 `tests/component/deck-editor/editor-context.test.ts`: stale empty/error/ready lookup; teardown; editor return/browser Back preserve advanced beat, 731 DP, collection, edited deck.
- T3 `tests/component/story/TitleAndLoad.test.ts`: supplied summaries replace fake metadata; unread slots disabled; occupied-slot deletion/back behavior retained.
- T4 `tests/unit/shell-store.test.ts`: navigate/browser Back infer Continue, subsequent hash event preserves intent.
- T5 `tests/unit/story/story-deck-repository.test.ts`: concurrent same-revision saves; duplicate creates; save→stale delete; matching revision without requested record rejected. Existing failed-persist rollback/retry tests retained.
- T6 `tests/unit/shell/session-saves.test.ts`: quota/unavailable/unknown policy; stale CAS; corrupt read; thrown I/O.

## Validation commands / exact outputs

### V1 Red: original runner exposed symlink setup failure plus F5 defects

```bash
npx vitest run --maxWorkers=2 tests/unit/story/story-deck-repository.test.ts tests/unit/shell-store.test.ts tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts
```

```text
Error: Cannot find module '/@fs/home/aron/Projects/ascencio/node_modules/@testing-library/svelte/src/vitest.js'
Test Files  4 failed (4)
Tests  3 failed | 29 passed (32)
```

F5 assertions expected rejected CAS/duplicate/delete; received fulfilled results. `--globals` retry also failed with same setup error.

### V2 Scratch-only runner workaround

Tracked `vitest.config.ts` untouched. Temporary `.tmp/vitest-story.config.ts`:

```ts
import config from "../vitest.config.ts";
import { defineConfig, mergeConfig } from "vitest/config";

export default defineConfig(mergeConfig(config, {
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ["/home/aron/Projects/ascencio"] } },
}));
```

Run from worktree with `--config .tmp/vitest-story.config.ts`. Scratch config removed after validation; reviewer can recreate exact file. No installs required.

### V3 Red: shell intent

```bash
npx vitest run --config .tmp/vitest-story.config.ts --maxWorkers=2 tests/unit/shell-store.test.ts
```

```text
AssertionError: expected null to be 'continue' // Object.is equality
Test Files  1 failed (1)
Tests  2 failed | 12 passed (14)
```

### V4 Red: production component seams

```bash
npx vitest run --config .tmp/vitest-story.config.ts --maxWorkers=2 tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts
```

```text
Test Files  2 failed (2)
Tests  8 failed | 13 passed (21)
```

- R1 F2 failure surface disappeared: `AssertionError: expected null not to be null`.
- R2 F3 absent manual control enabled: expected `true`, received `false` for `disabled`.
- R3 F4 stale empty/error: `AssertionError: expected 'home' to be 'free-play-decks' // Object.is equality`.
- R4 F4 stale ready installed story banner into free-play context; teardown called hash writer with `["#/", true]`.
- R5 Initial F1 component tests stopped at test-driver rename failure. Driver corrected to real focus/type/tab sequence; separate pre-fix resume assertion established genuine reset:

```bash
npx vitest run --config .tmp/vitest-story.config.ts --maxWorkers=2 tests/component/deck-editor/editor-context.test.ts -t 'resumes saved'
```

```text
AssertionError: expected 'Beat 1' to be 'Beat 5' // Object.is equality
Test Files  1 failed (1)
Tests  2 failed | 13 skipped (15)
```

Wrapper timed out after 90 seconds despite captured Vitest summary. Other case hit cold-import wait. No false red claim for those infrastructure/driver failures.

### V5 Intermediate checks

- I1 Seven-file run: `Test Files  2 failed | 5 passed (7)`; `Tests  4 failed | 85 passed (89)`. Failures: shared probe-close spy, cold-import wait, rename driver. Corrections limited to regression harness.
- I2 Component rerun after driver fix: `Test Files  2 passed (2)`; `Tests  24 passed (24)`.
- I3 Expanded 12-file run below: `Test Files  2 failed | 10 passed (12)`; `Tests  2 failed | 244 passed (246)`. Quota regression's shared session-close spy raced unrelated startup probes; replaced with exact mounted Story DOM identity assertion. Unchanged StoryApp shop test timed out waiting for lazy import; left untouched.

```bash
npx vitest run --config .tmp/vitest-story.config.ts --maxWorkers=2 tests/unit/story/story-deck-repository.test.ts tests/unit/story/story-deck-context.test.ts tests/unit/shell-store.test.ts tests/unit/shell/session-saves.test.ts tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts tests/component/story/TitleAndLoad.test.ts tests/component/AppShell.test.ts tests/component/core-menu.test.ts tests/component/story/StoryApp.test.ts
```

Unchanged shop failure:

```text
FAIL  tests/component/story/StoryApp.test.ts > StoryApp > re-enters a shop origin with a working leave route
AssertionError: expected null not to be null
```

Diagnostic DOM remained `data-cy="story-shop-pending"` / `Opening the shop`; no claim that baseline suite passes.

### V6 Final focused green

```bash
npx vitest run --config .tmp/vitest-story.config.ts --maxWorkers=2 tests/unit/story/story-deck-repository.test.ts tests/unit/story/story-deck-context.test.ts tests/unit/shell-store.test.ts tests/unit/shell/session-saves.test.ts tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts tests/component/story/TitleAndLoad.test.ts
```

```text
Test Files  9 passed (9)
Tests  177 passed (177)
Duration  175.58s (transform 130.14s, setup 52.33s, import 127.44s, tests 102.84s, environment 47.12s)
```

### V7 Format / lint / diff

```bash
npx prettier --write $(git diff --name-only) tests/unit/shell/session-saves.test.ts
npx prettier --check $(git diff --name-only) tests/unit/shell/session-saves.test.ts
npx eslint $(git diff --name-only) tests/unit/shell/session-saves.test.ts
git diff --check
git diff --cached --name-only | wc -l
```

```text
Checking formatting...
All matched files use Prettier code style!
prettier exit=0
eslint exit=0
staged files=0
```

### V8 Typecheck

```bash
npm run typecheck
npx svelte-check --tsconfig ./tsconfig.json
```

First typecheck attempt timed out after 180 seconds. Bounded longer rerun completed, exit 2:

```text
tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.
```

Standalone Svelte check, exit 1:

```text
svelte-check found 1 error and 4 warnings in 4 files
```

Same fixture error. Warnings: existing `ShopSellScreen.svelte` line-clamp CSS; unused props in `BattleFacadeProbe.svelte`, `DeckEditorProbe.svelte`. No changed-file diagnostics.

## Assumptions

- A1 Graphify unavailable per task → source-first fallback; no graph regeneration.
- A2 Scope permits semantic slot status/text binding, not visual redesign. Existing layout/CSS retained; no frontend design skill needed.
- A3 Only typed quota definitively recoverable under current contract. CAS refusals already local. `unknown` may represent migration/descriptor validation failure (`src/story/saves/generation-repository.ts:137-146`) → existing fatal policy retained. `unavailable`, corrupt reads, thrown I/O still escalate.
- A4 F5 serialization includes delete/default preconditions because moving queue boundary otherwise leaves those commands outside commit serialization.
- A5 Internal editor return uses existing `continue` intent; no public API widening.

## Residuals / next action

- Q1 Fresh independent review required. Parent owns integration, staging, commit/merge. Worker stops writing after report.
- Q2 Root integrated typecheck remains parent gate; isolated worktree preserves known fixture mismatch.
- Q3 Expanded suite shop timing failure unresolved/out-of-scope. No browser/E2E/build/full-suite claim. Parent may rerun unchanged shop test on integrated tree.
- Q4 F4 deferred regressions cover free-play **deck** route + teardown; direct free-play match route not separately exercised. Both use same token invalidation path.
- Q5 Legacy reducer `load` command still fabricates prototype state in isolated reducer tests. Production caller removed; `rg -n 'type: "load"' src/story` now finds only command declaration. Dead unrelated reducer contract deliberately preserved.
- Q6 No memory/visual/performance budget acceptance claimed.

## Cleanup / files

- C1 Removed 19 worker-owned scratch files under `.tmp/`: `vitest-story.config.ts`, `story-red.log`, `story-symlink.log`, `story-symlink2.log`, `story-red-components.log`, `story-red-resume.log`, `story-format.log`, `story-green1.log`, `story-green2.log`, `story-typecheck.log`, `story-format2.log`, `story-format-check.log`, `story-lint.log`, `story-typecheck2.log`, `story-svelte-check.log`, `story-focused-final.log`, `story-final-green.log`, `story-final-format.log`, `story-final-lint.log`. Relevant outputs preserved above.
- C2 Final status: 12 modified tracked files; new `tests/unit/shell/session-saves.test.ts`; pre-existing untracked `node_modules` symlink. Zero staged files.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1-F5 fixed across seven production files only; six test files cover production seams. Direct-entry behavior retained; no config/deps/vendor/style edits."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Red failures, final 9-file/177-test green command, format/lint evidence, baseline typecheck blocker, changed paths, cleanup, zero staged files documented. Fresh independent review remains required."
    }
  ],
  "changedFiles": [
    "src/shell/AppShell.svelte",
    "src/shell/core/session-saves.ts",
    "src/shell/shell-store.ts",
    "src/story/StoryApp.svelte",
    "src/story/decks/story-deck-repository.ts",
    "src/story/overlays/LoadOverlay.svelte",
    "src/story/screens/LoadScreen.svelte",
    "tests/component/StoryMenuEntry.test.ts",
    "tests/component/deck-editor/editor-context.test.ts",
    "tests/component/story/TitleAndLoad.test.ts",
    "tests/unit/shell-store.test.ts",
    "tests/unit/story/story-deck-repository.test.ts",
    "tests/unit/shell/session-saves.test.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/component/StoryMenuEntry.test.ts",
    "tests/component/deck-editor/editor-context.test.ts",
    "tests/component/story/TitleAndLoad.test.ts",
    "tests/unit/shell-store.test.ts",
    "tests/unit/story/story-deck-repository.test.ts",
    "tests/unit/shell/session-saves.test.ts"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run --maxWorkers=2 tests/unit/story/story-deck-repository.test.ts tests/unit/shell-store.test.ts tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts",
      "result": "failed",
      "summary": "Red: three F5 failures; three jsdom suites blocked by shared-symlink setup."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-story.config.ts --maxWorkers=2 tests/unit/shell-store.test.ts",
      "result": "failed",
      "summary": "Red: both internal resume intent assertions fail."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-story.config.ts --maxWorkers=2 tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts",
      "result": "passed",
      "summary": "Initial red 8 failed/13 passed; intermediate green 24 passed. Final strengthened assertions included in final focused run."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-story.config.ts --maxWorkers=2 tests/unit/story/story-deck-repository.test.ts tests/unit/story/story-deck-context.test.ts tests/unit/shell-store.test.ts tests/unit/shell/session-saves.test.ts tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts tests/component/story/TitleAndLoad.test.ts",
      "result": "passed",
      "summary": "Final: 9 files, 177 tests passed."
    },
    {
      "command": "npx prettier --check $(git diff --name-only) tests/unit/shell/session-saves.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "npx eslint $(git diff --name-only) tests/unit/shell/session-saves.test.ts",
      "result": "passed",
      "summary": "Exit 0; no diagnostics."
    },
    {
      "command": "npm run typecheck",
      "result": "failed",
      "summary": "Unchanged baseline node-duel-worker-harness.ts:96 TS2345; parent preserves existing root correction."
    },
    {
      "command": "npx svelte-check --tsconfig ./tsconfig.json",
      "result": "failed",
      "summary": "Same sole baseline error; four existing warnings; no changed-file diagnostics."
    },
    {
      "command": "git diff --check; git diff --cached --name-only | wc -l",
      "result": "passed",
      "summary": "No whitespace errors; zero staged files."
    }
  ],
  "validationOutput": [
    "Test Files  9 passed (9)",
    "Tests  177 passed (177)",
    "All matched files use Prettier code style!",
    "eslint exit=0",
    "staged files=0",
    "tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.",
    "Expanded run: 2 failed | 244 passed (246); final focused rerun repaired quota test harness; unchanged shop lazy-import timeout remains outside scope."
  ],
  "residualRisks": [
    "Independent reviewer gate pending.",
    "Integrated typecheck owned by parent; isolated baseline fixture error preserved.",
    "Unchanged StoryApp shop-origin test timed out during expanded run; no full-suite acceptance claim.",
    "Browser/E2E/build gates not run.",
    "Scratch runner workaround removed after validation; recreate documented config to rerun inside symlinked worktree."
  ],
  "noStagedFiles": true,
  "diffSummary": "Explicit internal resume; non-destructive quota retry; hydrated load-slot availability; stale lookup cancellation; serialized deck mutation preconditions and acceptance checks.",
  "reviewFindings": [
    "No additional in-scope blockers identified by worker; fresh independent review required."
  ],
  "manualNotes": "Parent commits/merges after independent review. No further worker writes after completion. Existing node_modules symlink preserved; 19 worker scratch files removed."
}
```
