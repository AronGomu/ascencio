# Runtime follow-up — implemented

## State / exact delta

- S1. **Done:** three assigned findings fixed on isolated `e7df0d0` worktree. 18 src/test files: 565 additions, 27 deletions, including new 233-line `tests/component/DuelFieldToggle.test.ts`. No staging, commits, pushes, subagents, vendor/loader/deps/tracked-config edits.
- S2. **Passed:** 689 tests across 18 focused suites; scoped ESLint, Prettier, `git diff --check`; automated Chromium native clicks/keyboard checks.
- S3. **Blocked baseline gate:** full TypeScript/Svelte checks retain only known `tests/fixtures/node-duel-worker-harness.ts:96:33` TS2345. User fixture correction deliberately not copied. Four pre-existing Svelte warnings remain.
- S4. **Next:** parent launches fresh reviewer against this diff. No reviewer launched here.

## Findings / fixes

- F1. **P1 — wrong SELECT_UNSELECT_CARD response. Fixed.** `src/battle/app/prompts/interaction-spec.ts:219` treats toggle-family responses as immediate singleton actions. `interaction-session.ts:133,203,209` submits clicked ID, rejects aggregate Confirm, maps Cancel to explicit engine-issued ID. Initial selected IDs remain core-state decoration. `src/battle/app/components/DuelField.svelte:1383,1548,1602`, `duel-field/MaterialSelectDialog.svelte:93,165,173`, `duel-field/ZoneListDialog.svelte:216,274` preserve behavior across mounted cards, target lists, materials; remove aggregate confirmation for toggles; keep Finish/Cancel reachable; list cap never suppresses legal engine toggle. Other multi-select flows unchanged.
- F2. **P2 — shop keyboard hijacks controls/modal focus. Fixed.** `src/story/shop/ShopGreetingScreen.svelte:47–55` now honors `event.defaultPrevented`, existing `isControl(event.target)` modal/control semantics. Repeat guard preserved; bare-stage Enter/Space still advances. Tests mount actual `ShopGreetingScreen`, `StoryTopBar`, `OverlayShell`; native settings activation remains intact. No visual redesign, overlay-wide refactor, unrelated story edits.
- F3. **P1 — authoritative draw crashes projection. Fixed.** `src/battle/worker/projection/DuelStateProjector.ts:548` converts WIN player 2 to completed `{winner:null, loser:null, reason}`. `src/battle/duel/contracts/duel-result.ts:10` explicitly types null pair; `duel-worker-event.ts:1233` validates paired nulls only, preserves strict player validation elsewhere. `src/battle/battle-contracts.ts:60` emits `outcome:"draw"`; `src/battle/app/components/DuelResultDialog.svelte:50` displays `Draw`. Player 0/1 wins, surrender, technical failure unchanged.
- F4. **Draw handoff policy preserved, not invented.** Existing `src/story/handoff/story-handoff.ts:75–89` maps draw to authored loss branch. Existing regression `tests/unit/story/story-handoff.test.ts:32` passed. `HeadlessDuelController.ts:191`, duel store, `App.svelte:566`, facade remain transparent result transport; no extra boundary changes required.

## Evidence

- E1. **Red before src fixes:** 12 failed / 82 passed across five suites. Mounted/list clicks returned `[]` instead of clicked toggle response. Native shop control assertions failed with `AssertionError: expected "vi.fn()" to be called once, but got 0 times`. Real WASM draw + facade projection failed with `Error: Unsupported player index: 2`.
- E2. **Green final:** `Test Files  18 passed (18)`; `Tests  689 passed (689)`; duration 55.28s. Includes added actual component → interaction reducer → validator → engine binding tests, zero/two selected cards, list selection cap, material toggle, Finish/Cancel, aggregate-confirm rejection, paired-null parser rejection tests.
- E3. **Real pinned engine:** `tests/integration/real-wasm-smoke.test.ts:14` runs in-memory `Duel.Win(0, 1)`, `Duel.Win(1, 1)`, `Duel.Win(2, 1)`. Actual WIN output → `DuelStateProjector` → structured clone → `parseDuelWorkerEvent` → facade outcome mapper. Three cases pass; exact draw output asserted `{type:5, player:2, reason:1}`. Core handles destroyed in `finally`.
- E4. **Facade/UI:** `tests/component/BattleFacade.test.ts:343` feeds exact pinned-core draw fixture through projector/parser into mounted facade/App. Asserts draw heading, reason, host draw outcome, duplicate-result/unmount settling once. Existing win/error/surrender tests passed.
- E5. **Chromium supplement:** real browser, scratch Vite, port 4516, no forced clicks. Final run twice passed. Browser fixture mounts production components with real prompt bindings; not full product E2E.

```text
PASS mounted A+B selected → click A → wire index 1 (A), not index 2 (B)
PASS list at selection cap → click unselected card → wire index 0
PASS selected material → click → wire clicked index 1
PASS shop Enter: native settings/close + dialog focus preserved; stage advances
PASS shop Space: native settings/close + dialog focus preserved; stage advances
PASS authoritative completed draw UI
PASS no browser page errors
```

- E6. **Scoped static gates:** ESLint all 18 changed files passed. Prettier all 18 passed: `All matched files use Prettier code style!`. `git diff --check` empty; `git diff --cached --name-only` empty.
- E7. **Type gate exact baseline:** `npx tsc --noEmit` returned only:

```text
tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.
```

- E8. `npx svelte-check --tsconfig ./tsconfig.json`: `svelte-check found 1 error and 4 warnings in 4 files`. Same TS2345; warnings in untouched `ShopSellScreen.svelte`, `BattleFacadeProbe.svelte` (two), `DeckEditorProbe.svelte`. No changed-file diagnostics.

## Reproduction cmds

Final focused cmd, executed from `/home/aron/Projects/ascencio/.tmp/codebase-audit-runtime-followup`:

```sh
NODE_OPTIONS=--no-experimental-webstorage npx vitest run --config .tmp/runtime-followup.vitest.config.ts --maxWorkers=1 tests/component/DuelFieldToggle.test.ts tests/component/DuelField.test.ts tests/component/FieldActionBar.test.ts tests/component/MaterialSelectDialog.test.ts tests/component/ZoneListDialog.test.ts tests/component/story/ShopGreeting.test.ts tests/component/BattleFacade.test.ts tests/component/DuelResultDialog.test.ts tests/unit/interaction-session.test.ts tests/unit/interaction-spec.test.ts tests/unit/prompt-registry.test.ts tests/unit/duel-state-projector.test.ts tests/unit/contracts.test.ts tests/unit/battle-contracts.test.ts tests/unit/story/story-handoff.test.ts tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts tests/integration/real-wasm-smoke.test.ts
```

Scratch config removed after validation per cleanup rule. To rerun inside shared-node_modules worktree, recreate `.tmp/runtime-followup.vitest.config.ts`:

```ts
import { mergeConfig } from "vitest/config";
import config from "../vitest.config.ts";
export default mergeConfig(config, {
  cacheDir: ".tmp/runtime-followup-vite-cache",
  resolve: { preserveSymlinks: true },
  server: {
    port: 4516,
    strictPort: true,
    fs: { allow: ["/home/aron/Projects/ascencio"] },
  },
});
```

Other executed checks:

```sh
git diff --name-only -z | xargs -0 npx eslint
npx eslint tests/component/DuelFieldToggle.test.ts
git diff --name-only -z | xargs -0 npx prettier --check
npx prettier --check tests/component/DuelFieldToggle.test.ts
npx tsc --noEmit
npx svelte-check --tsconfig ./tsconfig.json
git diff --check
git diff --cached --name-only
node .tmp/runtime-followup-browser.mjs
```

## Assumptions

- A1. Minimal authoritative draw encoding = completed result with paired null winner/loser; no player-index widening. Existing result keys/reason preserved.
- A2. Engine min/max on SELECT_UNSELECT_CARD describe core selection, not response arity. `PromptRegistry.ts:477–517` still requires exactly one ID; no validator/encoder weakening.
- A3. Existing draw→story-loss policy remains authority; no payout decisions taken.
- A4. Impeccable loaded from root project skill: context script, harden, craft-floor. Incumbent component semantics/styles preserved. Graph-first attempted; `/bin/bash: line 1: graphify: command not found` → source inspection fallback.

## Residual risks / preserved state

- R1. Full repo typecheck blocked by known fixture TS2345. Exact next action: parent/user integrates separately owned fixture correction, reruns type gates. No baseline correction copied into this branch.
- R2. No full app build, full unit/component/integration suite, production E2E, scripted gameplay draw scenario, or visual redesign acceptance claimed. Real-core `Duel.Win` integration, mounted facade tests, Chromium component harness establish narrow findings only.
- R3. Initial Node 26 run exposed `localStorage` unavailable; tests rerun with `NODE_OPTIONS=--no-experimental-webstorage` → isolated intended failures, then green. Initial Chromium scratch attempts timed out during harness CSS/dependency setup; app stylesheet loaded, warm reruns passed twice. Production code not changed for harness issues.
- R4. Required ownership overlap limited to assigned `src/story/shop/ShopGreetingScreen.svelte` + `tests/component/story/ShopGreeting.test.ts`. No other worker-owned story/core/decks/content files edited.
- R5. Existing untracked `node_modules` symlink preserved. New `tests/component/DuelFieldToggle.test.ts` remains untracked intentionally: staging prohibited. Parent must include it during later approved staging.
- R6. Cleanup removed only own scratch: `.tmp/runtime-followup.vitest.config.ts`, `.tmp/RuntimeFollowupHarness.svelte`, `.tmp/runtime-followup.html`, `.tmp/runtime-followup-browser.mjs`; `.tmp/runtime-red.log`, `.tmp/runtime-green.log`, `.tmp/runtime-tsc.log`, `.tmp/runtime-expanded.log`, `.tmp/runtime-svelte.log`, `.tmp/runtime-browser.log`, `.tmp/runtime-final-tests.log`, `.tmp/runtime-browser-final.log`; generated caches `.tmp/runtime-followup-vite-cache`, `.tmp/runtime-followup-browser-vite-cache`. Chromium server closed. Deliverable report retained.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1 P1 toggle response, F2 P2 shop keyboard, F3 P1 draw projection fixed with exact source references, red failures, 689 green tests, automated Chromium evidence. Residual baseline gate explicitly recorded."
    }
  ],
  "changedFiles": [
    "src/battle/app/components/DuelField.svelte",
    "src/battle/app/components/DuelResultDialog.svelte",
    "src/battle/app/components/duel-field/MaterialSelectDialog.svelte",
    "src/battle/app/components/duel-field/ZoneListDialog.svelte",
    "src/battle/app/prompts/interaction-session.ts",
    "src/battle/app/prompts/interaction-spec.ts",
    "src/battle/battle-contracts.ts",
    "src/battle/duel/contracts/duel-result.ts",
    "src/battle/duel/contracts/duel-worker-event.ts",
    "src/battle/worker/projection/DuelStateProjector.ts",
    "src/story/shop/ShopGreetingScreen.svelte",
    "tests/component/BattleFacade.test.ts",
    "tests/component/DuelField.test.ts",
    "tests/component/DuelFieldToggle.test.ts",
    "tests/component/story/ShopGreeting.test.ts",
    "tests/integration/real-wasm-smoke.test.ts",
    "tests/unit/contracts.test.ts",
    "tests/unit/interaction-session.test.ts",
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/runtime-followup-worker.md"
  ],
  "testsAddedOrUpdated": [
    "tests/component/BattleFacade.test.ts",
    "tests/component/DuelField.test.ts",
    "tests/component/DuelFieldToggle.test.ts",
    "tests/component/story/ShopGreeting.test.ts",
    "tests/integration/real-wasm-smoke.test.ts",
    "tests/unit/contracts.test.ts",
    "tests/unit/interaction-session.test.ts"
  ],
  "commandsRun": [
    {"command":"NODE_OPTIONS=--no-experimental-webstorage npx vitest run --config .tmp/runtime-followup.vitest.config.ts --maxWorkers=1 <18 suites listed above>","result":"passed","summary":"689 tests passed across 18 suites; prior red 12 failed / 82 passed."},
    {"command":"node .tmp/runtime-followup-browser.mjs","result":"passed","summary":"Chromium mounted/list/material clicks, Enter/Space native controls/dialog focus/stage, draw UI. Final two runs passed; scratch removed."},
    {"command":"git diff --name-only -z | xargs -0 npx eslint; npx eslint tests/component/DuelFieldToggle.test.ts","result":"passed","summary":"All 18 changed src/test files."},
    {"command":"git diff --name-only -z | xargs -0 npx prettier --check; npx prettier --check tests/component/DuelFieldToggle.test.ts","result":"passed","summary":"All matched files use Prettier code style!"},
    {"command":"npx tsc --noEmit","result":"failed","summary":"Only known node-duel-worker-harness.ts:96:33 TS2345; no changed-file diagnostics."},
    {"command":"npx svelte-check --tsconfig ./tsconfig.json","result":"failed","summary":"Same known fixture error; four pre-existing warnings in untouched files."},
    {"command":"git diff --check; git diff --cached --name-only","result":"passed","summary":"No whitespace errors; nothing staged."}
  ],
  "validationOutput": [
    "Red: 12 failed / 82 passed. Green: Test Files 18 passed (18); Tests 689 passed (689).",
    "Pinned WASM Duel.Win(2,1) emits type 5, player 2, reason 1; accepted completed draw reaches host/UI.",
    "Chromium: seven PASS lines, no page errors.",
    "Known baseline: tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'."
  ],
  "residualRisks": [
    "Known fixture TS2345 blocks full repo type gate; separately owned correction not copied.",
    "No full production build/E2E or full suite claim; narrow automated Chromium component harness only.",
    "New regression file remains untracked because staging prohibited; parent must include it later.",
    "Existing untracked node_modules symlink preserved; worktree intentionally dirty."
  ],
  "noStagedFiles": true,
  "diffSummary": "Three assigned fixes only: singleton toggle semantics on every field surface; guarded shop keys; coherent completed draw projection/parser/UI/handoff. 18 src/test files, +565/-27. Report outside isolated worktree.",
  "reviewFindings": [
    "Fixed P1 F1: src/battle/app/prompts/interaction-session.ts:133 — clicked toggle ID now reaches engine, not remaining selection.",
    "Fixed P2 F2: src/story/shop/ShopGreetingScreen.svelte:47 — native control/modal keyboard behavior preserved.",
    "Fixed P1 F3: src/battle/worker/projection/DuelStateProjector.ts:548 — engine draw no longer throws; paired-null result reaches Draw UI and draw host outcome.",
    "No new in-scope blockers found; independent fresh review pending."
  ],
  "manualNotes": "No staging/commit/push/subagents. Graphify unavailable. Impeccable hardening guidance read. Existing story draw policy preserved. Own scratch removed after checks; report includes test-config recreation. Parent launches fresh reviewer."
}
```
