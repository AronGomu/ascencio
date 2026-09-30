# Runtime follow-up — independent review

## State

- S1. **Done · APPROVED appended delta.** Base `e7df0d0a8b6c0f388a90ef9b46e6d2986ff27689`; 18 src/test files reviewed, including untracked `tests/component/DuelFieldToggle.test.ts`. No new in-scope defects found. Reviewer src/test edits: none.
- S2. **Evidence:** independently passed **689 tests / 18 suites**, scoped ESLint, Prettier, whitespace check. Real pinned WASM draw provenance verified. Full type gates remain blocked solely by known baseline fixture error.
- S3. **Files touched:** this report only, temporary test cache generated/removed. No staging, commits, vendor/loader/config/deps edits, root-only corrections, subagents. Original dirty delta preserved.

## Review

- F1. **Correct — prior P1 singleton-toggle defect resolved.** `src/battle/app/prompts/interaction-session.ts:129–134` submits clicked ID, not remaining selection; `:201–215` rejects aggregate Confirm, resolves Cancel through explicit choice ID. `interaction-spec.ts:215–223` makes toggle-family mounted clicks immediate. Actual surfaces: `DuelField.svelte:587–591,1383–1386`, `duel-field/ZoneListDialog.svelte:216–219,274`, `duel-field/MaterialSelectDialog.svelte:93–96,165–180`. Core selection cap no longer disables legal listed toggle. Existing validator remains singleton-only (`prompt-selection.ts:56`); engine binding remains `exactlyOne` → concatenated select/unselect index (`PromptRegistry.ts:477–517`). `tests/component/DuelFieldToggle.test.ts:94–105,125–231` mounts production field → reducer → validator → binding, checks clicked index with zero/two selected cards, list-at-cap, material clicks, explicit Finish/Cancel. All ten tests pass.
- F2. **Correct — prior P1 draw projection defect resolved.** `src/battle/worker/projection/DuelStateProjector.ts:547–557` maps only WIN player 2 to completed paired-null result. `duel/contracts/duel-result.ts:10–15` models pair explicitly; `duel-worker-event.ts:1233–1244` accepts paired nulls, rejects mixed null/player values, retains reason validation. `battle-contracts.ts:60–64` maps draw; `app/components/DuelResultDialog.svelte:50–55` renders `Draw`. Invalid player 2 remains invalid elsewhere. Existing transport stays transparent: `HeadlessDuelController.ts:191–197,236–243` → `DuelWorkerRuntime.ts:719–720` → `app/stores/duel-store.ts:276–289` → `app/App.svelte:565–572` → `BattleFacade.svelte:45,77`. Real WASM `Duel.Win(0, 1)`, `Duel.Win(1, 1)`, `Duel.Win(2, 1)` all pass (`tests/integration/real-wasm-smoke.test.ts:14–80`); draw message asserted before projection, clone/parser, facade mapper. Mounted facade test verifies Draw UI, reason, exactly-once host completion across duplicate events/unmount (`tests/component/BattleFacade.test.ts:343–372`). Existing draw→loss story policy unchanged (`src/story/handoff/story-handoff.ts:75–89`; passing `tests/unit/story/story-handoff.test.ts:32`). No reward policy invented.
- F3. **Correct — prior P2 shop keyboard defect resolved.** `src/story/shop/ShopGreetingScreen.svelte:47–57` honors repeat/defaultPrevented/control/dialog guards before Enter/Space consumption. Existing `isControl` at `:39–44` matches actual shop top-bar buttons, overlay controls/dialog focus; callers inspected in `src/story/StoryApp.svelte:990–1009,1157–1168,1332–1351`. `tests/component/story/ShopGreeting.test.ts:12–66` uses production `StoryTopBar`/`OverlayShell`, verifies native control activation, non-control dialog focus, consumed/repeated keys, bare-stage advancement. Nine shop tests pass.
- F4. **Fixed:** none needed during independent review. Worker delta remains unchanged: tracked +332/−27, new 233-line toggle test → total +565/−27.
- F5. **Blocker:** no appended-delta blocker. Baseline whole-repo type gate remains blocked at `tests/fixtures/node-duel-worker-harness.ts:96:33`; not caused by reviewed edits. Exact next integration action: retain separately owned fixture correction in root, rerun `npx tsc --noEmit` plus `npx svelte-check --tsconfig ./tsconfig.json`.

## Validation

- E1. Final independent run: `Test Files 18 passed (18)`; `Tests 689 passed (689)`; duration **181.20s**. Includes domain-boundary/data-cy gates, adjacent normal selection tests, parser negatives, real-core outcomes. Reproduction below uses inline scratch overrides, preserved shared symlinks, unique cache; tracked config untouched.

```sh
NODE_OPTIONS=--no-experimental-webstorage node --input-type=module <<'EOF'
import { startVitest } from 'vitest/node';
const ctx = await startVitest('test', [
 'tests/component/DuelFieldToggle.test.ts', 'tests/component/DuelField.test.ts',
 'tests/component/FieldActionBar.test.ts', 'tests/component/MaterialSelectDialog.test.ts',
 'tests/component/ZoneListDialog.test.ts', 'tests/component/story/ShopGreeting.test.ts',
 'tests/component/BattleFacade.test.ts', 'tests/component/DuelResultDialog.test.ts',
 'tests/unit/interaction-session.test.ts', 'tests/unit/interaction-spec.test.ts',
 'tests/unit/prompt-registry.test.ts', 'tests/unit/duel-state-projector.test.ts',
 'tests/unit/contracts.test.ts', 'tests/unit/battle-contracts.test.ts',
 'tests/unit/story/story-handoff.test.ts', 'tests/unit/domain-boundaries.test.ts',
 'tests/unit/data-cy-coverage.test.ts', 'tests/integration/real-wasm-smoke.test.ts'
], { watch: false, maxWorkers: 1, cache: false, configLoader: 'native', reporters: ['verbose'] }, {
 cacheDir: '.tmp/runtime-followup-review-astra-vite-cache',
 resolve: { preserveSymlinks: true },
 server: { fs: { allow: ['/home/aron/Projects/ascencio'] } }
});
await ctx.close();
EOF
```

- E2. Node **v26.7.0** initially required webstorage workaround: first run **19 failed / 670 passed**, all failures in facade suite; primary failure `TypeError: Cannot read properties of undefined (reading 'clear')` at `tests/component/BattleFacade.test.ts:189:16`, accompanied by `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.` Applied `NODE_OPTIONS=--no-experimental-webstorage` only after reproducing. First corrected run exceeded tool's 120s timeout; retry with 300s tool limit completed E1. No src repairs for env failures.
- E3. Passed `git diff --name-only -z | xargs -0 npx eslint`; `npx eslint tests/component/DuelFieldToggle.test.ts`. Passed equivalent Prettier checks: `All matched files use Prettier code style!`. Passed `git diff --check`; `git diff --cached --name-only` empty.
- E4. `npx tsc --noEmit` failed solely with:

```text
tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.
```

- E5. `npx svelte-check --tsconfig ./tsconfig.json`: `svelte-check found 1 error and 4 warnings in 4 files`. Same fixture error; existing warnings in untouched `ShopSellScreen.svelte`, `BattleFacadeProbe.svelte` (two), `DeckEditorProbe.svelte`. No changed-file diagnostics.
- E6. Graph-first attempted; `/bin/bash: line 1: graphify: command not found` → direct source/diff tracing. Reviewed `AGENTS.md`, worker report, relevant ADR-022 boundaries before conclusions.
- E7. Cleanup removed only generated `.tmp/runtime-followup-review-astra-vite-cache`; final `find .tmp -mindepth 1 -maxdepth 2 -print` empty. Final HEAD unchanged; staging empty; initial src/test dirty paths unchanged. Existing `node_modules` symlink preserved.

## Assumptions

- A1. Appended delta = working changes relative to supplied reviewed base `e7df0d0`; initial Battle audit not reopened.
- A2. Existing authored draw→loss story mapping remains authority. Review checks transport, not new draw rewards.
- A3. Existing worker Chromium evidence treated as prior evidence only. Independent reviewer attests source tracing, mounted component tests, real Node/WASM execution; no independent browser claim.

## Residual risks

- R1. Whole-repo type gates remain baseline-blocked per F5; this is scoped code approval, not clean whole-repo gate certification.
- R2. No independent production build, full suite, browser/E2E, natural gameplay-generated draw, or visual acceptance run. Real `Duel.Win` test proves pinned-core message provenance plus result mapping, not full gameplay scenario. Facade test separately proves mounted UI/host seam.
- R3. New regression file remains untracked by instruction. Parent must include `tests/component/DuelFieldToggle.test.ts` during later authorized integration; omitting it loses main F1 regression coverage.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1–F3 independently verified with precise src/test locations, 689 passing tests, actual pinned-core WIN draw provenance. F5/R1–R3 identify baseline blocker plus residual limits. Appended delta approved."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/runtime-followup-review.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "node --input-type=module (E1 inline Vitest harness, initially without NODE_OPTIONS)",
      "result": "failed",
      "summary": "19 facade failures / 670 passes; Node 26 localStorage.clear unavailable. Required workaround established."
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node --input-type=module (E1 harness, 120s tool limit)",
      "result": "failed",
      "summary": "Tool timeout; no completed result claimed."
    },
    {
      "command": "NODE_OPTIONS=--no-experimental-webstorage node --input-type=module (exact E1 harness, 300s tool limit)",
      "result": "passed",
      "summary": "18 suites, 689 tests, 181.20s. Real WASM outcomes 0/1/2; toggle component seams; shop guards; boundary gates."
    },
    {
      "command": "git diff --name-only -z | xargs -0 npx eslint; npx eslint tests/component/DuelFieldToggle.test.ts",
      "result": "passed",
      "summary": "All 18 reviewed src/test files."
    },
    {
      "command": "git diff --name-only -z | xargs -0 npx prettier --check; npx prettier --check tests/component/DuelFieldToggle.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "npx tsc --noEmit",
      "result": "failed",
      "summary": "Known fixture TS2345 only; no changed-file diagnostics."
    },
    {
      "command": "npx svelte-check --tsconfig ./tsconfig.json",
      "result": "failed",
      "summary": "Same fixture error; four untouched-file warnings."
    },
    {
      "command": "git diff --check; git diff --cached --name-only; git status --short; git rev-parse HEAD",
      "result": "passed",
      "summary": "Whitespace clean; staging empty; original dirty delta preserved; HEAD e7df0d0 unchanged."
    }
  ],
  "validationOutput": [
    "Test Files 18 passed (18); Tests 689 passed (689).",
    "Real Duel.Win(2, 1) emits WIN player 2; paired-null completed result survives clone/parser, maps draw; mounted facade displays Draw, settles host once.",
    "tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.",
    "svelte-check found 1 error and 4 warnings in 4 files"
  ],
  "residualRisks": [
    "Known baseline fixture blocks full type gates; root-only correction deliberately not copied.",
    "No independent browser/E2E, production build, full suite, or natural gameplay draw scenario run.",
    "Parent must include untracked tests/component/DuelFieldToggle.test.ts during later authorized integration."
  ],
  "noStagedFiles": true,
  "diffSummary": "APPROVED appended 18-file delta (+565/-27 including new regression). Reviewer source/test edits: none. Report written; own generated test cache removed.",
  "reviewFindings": [
    "No new in-scope defects/blockers found.",
    "Verified prior P1 F1 fix: src/battle/app/prompts/interaction-session.ts:133 — clicked singleton survives actual field/list/material seams.",
    "Verified prior P1 F2 fix: src/battle/worker/projection/DuelStateProjector.ts:548 — authoritative draw survives contract/parser/facade/UI; existing story policy preserved.",
    "Verified prior P2 F3 fix: src/story/shop/ShopGreetingScreen.svelte:47 — native controls/dialog/defaultPrevented preserved; bare stage advances.",
    "Baseline gate blocker: tests/fixtures/node-duel-worker-harness.ts:96:33 — pre-existing TS2345, outside delta."
  ],
  "manualNotes": "No reviewer code fixes needed. Graphify unavailable. Node webstorage workaround independently reproduced before use. Worker browser evidence not relabeled as reviewer execution. No writes after final report."
}
```
