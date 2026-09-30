# UI hardening — E1–E3 / F1–F3

## State

- S1. **Done, checked:** six scoped fixes. Final component run: **397/397 passed**, 10 files. Chromium: **4/4 passed**, two consecutive final runs. Fresh independent review remains required.
- S2. Baseline: `26da1264d4f8a93b99059a02472de27498db43df`; isolated worktree `/home/aron/Projects/ascencio/.tmp/codebase-audit-ui`.
- S3. No staging/commit/push/install/download/subagents. Final `git diff --cached --name-only | wc -l` → `0`. `git diff --check` → exit 0. Port `4517` released; `ss -ltn 'sport = :4517'` → header only.

## Requirements → implementation → evidence

| ID | Primary-source requirement | Scoped implementation | Regression evidence |
|---|---|---|---|
| E1 | `ShopCardListScreen.svelte:135–139` preview via focus; `:157` affordability gates Buy. Impeccable `reference/harden.md:252–255` requires keyboard access. | `src/story/shop/ShopCardListScreen.svelte:127–139`: focusable named card group; existing focus preview retained. Buy disabled unchanged. Intentional passive-preview tabindex exception documented. | `tests/component/story/ShopCardList.test.ts:264`; `tests/ui-hardening.chromium.mjs:46`: native Tab reaches second unaffordable card, effect text updates, Enter/Space never buy. |
| E2 | `AGENTS.md:136`: unique rendered `data-cy`, stable loop identity. | `DuelHud.svelte:84–245`: player/card/counter suffixes; counter combines host identity + existing counter identity. `PromptControls.svelte:349–403`: choice-id suffixes for text, contribution, order index. | `tests/component/DuelHud.test.ts:19`, `PromptControls.test.ts:80`: two players, repeated counters/materials, multiple/order prompts, reordered identity stability. Existing coverage/boundary suites pass. |
| E3 | `src/story/handoff/story-handoff.ts:65–70`: canonical `ENCOUNTER_LABELS`; `StoryApp.svelte:476–479` already derives current label. | `src/story/StoryApp.svelte:1102`: pass existing `encounterLabel` as `opponentName`. No new mapping. | `tests/component/story/pre-battle-deck-picker.test.ts:506`: actual reward acknowledgment unlocks Archive; map selection → title + locked seat + handoff all `Archive echo`. Old Arena retained. |
| F1 | `DuelFieldErrorBoundary.svelte:80–82`: promise `"Prompt controls remain available. No private engine detail was shown."`; `prompt-surface.ts:18–22`: field availability gates fallback. | `DuelFieldErrorBoundary.svelte:35–36,72–77,113`: failure callback, retry/unmount clears failure. `App.svelte:206,360,1224–1226`: failed field unavailable to prompt routing. | `tests/component/AppChrome.test.ts:301`: mounted App, injected render failure, nontrivial live card-selection prompt; fallback submits exact selected id. Retry restores field, removes fallback, dispatches no response. |
| F2 | `SettingsDialog.svelte` declares `aria-modal`; Impeccable `reference/harden.md:255` requires modal focus mgmt. | `src/battle/app/components/SettingsDialog.svelte:44–95`: inert live ancestor siblings after portal placement; Tab/Shift+Tab wrap enabled controls; Escape contained; restore only owned inert attributes + connected trigger focus. Existing App rail restoration retained. | `SettingsDialog.test.ts:27`: both portal modes. `AppChrome.test.ts:381`: live duel stays inert, no response. Chromium `ui-hardening.chromium.mjs:87`: repeated Tab, programmatic underlying card focus refused, Enter/Space cannot act; close restores trigger + underlying action. |
| F3 | `SettingsDialog.svelte:8–9`: `"Draw a soft shadow under every card on the field."`; board exposes `data-card-shadows`. | `src/styles/app.css:2584–2598,2793–2796,2819–2822`: setting-dependent decorative shadow vars for card/article/art/material. Semantic halo rules untouched. | Chromium `ui-hardening.chromium.mjs:149`: computed card/art/material shadows off → all `none`; legal/selected shadows identical before/after; focus-visible outline retained; enabling restores original decorative values. |

Paths shortened in table resolve beneath existing component/test domains named there. Impeccable guidance read from `.agents/skills/impeccable/reference/{harden,audit}.md`; keyboard/focus audit requirement: `audit.md:17`.

## Red → green

- V1. Tests written before impl. Finalized tests replayed against original HEAD versions of eight impl files; worker edits then restored byte-for-byte in `finally`. **Baseline: 10 failed / 96 passed**, six component files. Browser baseline: **4 failed / 0 passed**. Logs: `ui-evidence/final-component-red.log`, `ui-evidence/final-chromium-red.log`.
- V2. Exact baseline errors: HUD `AssertionError: expected 88 to be 110 // Object.is equality`; multiple prompt `AssertionError: expected 19 to be 21 // Object.is equality`; ordering `AssertionError: expected 21 to be 22 // Object.is equality`; Archive `Expected: "Archive echo"`, `Received: "Rin's Echo"`; App fallback `AssertionError: expected null not to be null`.
- V3. Browser baseline shadow output: article `none`; art/material still `color(srgb 0 0 0 / 0.32) 0px 5.6px 12.8px 0px`. Fixed test asserts all three `none` without halo loss.
- V4. Final expanded component run: `Test Files  10 passed (10)`; `Tests  397 passed (397)`. Log: `ui-evidence/final-component-green.log`.
- V5. Final Chromium runs: `PASS E1 unaffordable keyboard preview`; `PASS F2 modal keyboard isolation portal=false`; `PASS F2 modal keyboard isolation portal=true`; `PASS F3 decorative shadows off, semantic halos preserved`. Logs: `ui-evidence/chromium-repeat-1.log`, `ui-evidence/chromium-repeat-2.log`.
- V6. Scoped ESLint exit 0; Prettier `All matched files use Prettier code style!`; whitespace diff clean. Logs: `ui-evidence/final-lint.log`, `ui-evidence/final-format.log`, `ui-evidence/diff-check.log`.
- V7. Full type gates remain baseline-blocked: `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.` No fixture repair. `svelte-check found 1 error and 4 warnings in 4 files`; same fixture error, existing unrelated warnings. Logs: `ui-evidence/typecheck.log`, `ui-evidence/svelte-check.log`.

Evidence directory: `/home/aron/Projects/ascencio/artifacts/codebase-audit/ui-evidence/`.

## Commands / reproduction

Node observed: `v26.7.0`. Existing browser/deps reused. Node webstorage disabled for Vitest: initial unflagged run exposed Node's absent `localStorage`, cascading App cleanup failures; flagged baseline/final runs isolate intended regressions.

Recreate removed, worker-owned test setup inside isolated worktree:

```bash
mkdir -p .tmp
ln -s /home/aron/Projects/ascencio/generated generated
cat > .tmp/ui-vitest.config.ts <<'EOF'
import { mergeConfig } from 'vitest/config';
import base from '../vitest.config.ts';
export default mergeConfig(base, { cacheDir: '.tmp/ui-vitest-cache', resolve: { preserveSymlinks: true }, server: { fs: { allow: ['/home/aron/Projects/ascencio'] } } });
EOF
NODE_OPTIONS=--no-experimental-webstorage node_modules/.bin/vitest run --config .tmp/ui-vitest.config.ts tests/component/SettingsDialog.test.ts tests/component/DuelHud.test.ts tests/component/PromptControls.test.ts tests/component/AppChrome.test.ts tests/component/story/ShopCardList.test.ts tests/component/story/pre-battle-deck-picker.test.ts tests/component/DuelField.test.ts tests/component/FieldBoard.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/domain-boundaries.test.ts
node tests/ui-hardening.chromium.mjs
node_modules/.bin/eslint $(git diff --name-only -- '*.ts' '*.svelte') tests/fixtures/UiHardeningHarness.svelte tests/fixtures/ui-hardening.ts tests/ui-hardening.chromium.mjs
node_modules/.bin/prettier --check $(git diff --name-only) tests/fixtures/UiHardeningHarness.svelte tests/fixtures/ui-hardening.html tests/fixtures/ui-hardening.ts tests/ui-hardening.chromium.mjs
node_modules/.bin/tsc --noEmit
node_modules/.bin/svelte-check --tsconfig ./tsconfig.json
git diff --check
git diff --cached --name-only
```

Browser runner owns strict port `4517`, unique `.tmp/ui-hardening-vite-cache`, symlink preservation, parent fs allow. External browser reqs blocked. No live download. Generated symlink needed only for existing metadata-fixture component test; skip recreation when running merged parent repo with existing `generated/`.

## Assumptions

- A1. Six audited findings define scope; toggles/draw/shop greeting excluded. No broad refactor, deps/config/vendor edits.
- A2. Passive focusable card group fits existing preview semantics; no new purchase/selection action. Existing visual identity retained; only intended focus/decorative-shadow behavior changes.
- A3. Graph-first query + post-edit update attempted; both unavailable: `/bin/bash: line 1: graphify: command not found`. Direct source inspection substituted; `ui-evidence/graphify.log`.
- A4. Browser harness tests actual SettingsDialog/ShopCardListScreen/FieldBoard components + real app CSS. App error lifecycle checked through mounted real App + mocked worker, not real-WASM browser duel.

## Changed paths / merge overlap

- C1. Impl: `src/battle/app/App.svelte`.
- C2. Impl: `src/battle/app/components/SettingsDialog.svelte`.
- C3. Impl: `src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte`.
- C4. Impl: `src/battle/app/components/duel-field/DuelHud.svelte`.
- C5. Impl: `src/battle/app/prompts/PromptControls.svelte`.
- C6. Impl: `src/story/StoryApp.svelte`.
- C7. Impl: `src/story/shop/ShopCardListScreen.svelte`.
- C8. Impl: `src/styles/app.css`.
- C9. Tests: `tests/component/AppChrome.test.ts`.
- C10. Tests: `tests/component/DuelHud.test.ts`.
- C11. Tests: `tests/component/PromptControls.test.ts`.
- C12. Tests: `tests/component/SettingsDialog.test.ts`.
- C13. Tests: `tests/component/story/ShopCardList.test.ts`.
- C14. Tests: `tests/component/story/pre-battle-deck-picker.test.ts`.
- C15. New fixture: `tests/fixtures/UiHardeningHarness.svelte`.
- C16. New fixture: `tests/fixtures/ui-hardening.html`.
- C17. New fixture: `tests/fixtures/ui-hardening.ts`.
- C18. New Chromium runner: `tests/ui-hardening.chromium.mjs`.

- M1. `App.svelte` overlap: only failure boolean, field-availability expression, internal boundary callback. No result/draw/toggle changes.
- M2. `PromptControls.svelte` overlap: only multiple text/contribution + order-index selectors. No response handling, toggle semantics, announcement paging changes. Preserve followup worker hunks.
- M3. `StoryApp.svelte`: one briefing prop only. `ShopCardListScreen.svelte`: tabindex + explanatory Svelte exception only. No greeting changes.

## Residual risks / next action

- R1. Fresh reviewer required; not launched from worker. Parent next: review scoped diff + evidence, merge distinct overlapping hunks, rerun focused tests.
- R2. Type gates blocked by known excluded fixture error (V7). Full build, full test corpus, real-WASM E2E, screenshots, perf not run. No whole-repo clean claim; pre-existing untracked `node_modules` symlink preserved.
- R3. Two intermediate browser runs timed out waiting for first shop tile before assertions: `locator.waitFor: Timeout 30000ms exceeded.` Remaining checks passed. Cause uncertain. Diagnostic rerun + two final unchanged-source runs passed all four checks; timeout logs retained as `ui-evidence/final-chromium-green.log`, `ui-evidence/final-chromium-rerun.log`. Reviewer should repeat Chromium runner; no hidden retries inside runner.
- R4. Existing ChainStatus repeated descendant selectors outside E2's assigned DuelHud/multiple/order sites remain untouched. HUD uniqueness regression uses empty chain to isolate assigned subtree (`tests/component/DuelHud.test.ts:30`). No whole-document uniqueness claim for unassigned chain contents.
- R5. Cleanup complete: removed own `generated` symlink, `.tmp/ui-evidence`, `.tmp/ui-hardening-vite-cache`, `.tmp/ui-vitest-cache`, `.tmp/ui-vitest.config.ts`. Retained requested report, evidence logs, new regression fixtures. Parent/root generated target untouched.

```acceptance-report
{
  "criteriaSatisfied": [
    { "id": "criterion-1", "status": "satisfied", "evidence": "E1-E3/F1-F3 fixed in eight impl files; no toggle/draw/greeting/deps/config/vendor changes." },
    { "id": "criterion-2", "status": "satisfied", "evidence": "Finalized baseline: 10 mounted regressions fail, four Chromium checks fail. Fixed: 397 tests pass; four Chromium checks pass twice consecutively. Exact logs, cmds, source refs retained." }
  ],
  "changedFiles": [
    "src/battle/app/App.svelte",
    "src/battle/app/components/SettingsDialog.svelte",
    "src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte",
    "src/battle/app/components/duel-field/DuelHud.svelte",
    "src/battle/app/prompts/PromptControls.svelte",
    "src/story/StoryApp.svelte",
    "src/story/shop/ShopCardListScreen.svelte",
    "src/styles/app.css",
    "tests/component/AppChrome.test.ts",
    "tests/component/DuelHud.test.ts",
    "tests/component/PromptControls.test.ts",
    "tests/component/SettingsDialog.test.ts",
    "tests/component/story/ShopCardList.test.ts",
    "tests/component/story/pre-battle-deck-picker.test.ts",
    "tests/fixtures/UiHardeningHarness.svelte",
    "tests/fixtures/ui-hardening.html",
    "tests/fixtures/ui-hardening.ts",
    "tests/ui-hardening.chromium.mjs"
  ],
  "testsAddedOrUpdated": [
    "tests/component/AppChrome.test.ts",
    "tests/component/DuelHud.test.ts",
    "tests/component/PromptControls.test.ts",
    "tests/component/SettingsDialog.test.ts",
    "tests/component/story/ShopCardList.test.ts",
    "tests/component/story/pre-battle-deck-picker.test.ts",
    "tests/fixtures/UiHardeningHarness.svelte",
    "tests/fixtures/ui-hardening.html",
    "tests/fixtures/ui-hardening.ts",
    "tests/ui-hardening.chromium.mjs"
  ],
  "commandsRun": [
    { "command": "NODE_OPTIONS=--no-experimental-webstorage node_modules/.bin/vitest run --config .tmp/ui-vitest.config.ts tests/component/SettingsDialog.test.ts tests/component/DuelHud.test.ts tests/component/PromptControls.test.ts tests/component/AppChrome.test.ts tests/component/story/ShopCardList.test.ts tests/component/story/pre-battle-deck-picker.test.ts tests/component/DuelField.test.ts tests/component/FieldBoard.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/domain-boundaries.test.ts", "result": "passed", "summary": "397 tests, ten files" },
    { "command": "node tests/ui-hardening.chromium.mjs", "result": "passed", "summary": "Four checks passed twice consecutively; earlier two first-shop-tile timeouts retained" },
    { "command": "node_modules/.bin/eslint $(git diff --name-only -- '*.ts' '*.svelte') tests/fixtures/UiHardeningHarness.svelte tests/fixtures/ui-hardening.ts tests/ui-hardening.chromium.mjs", "result": "passed", "summary": "exit 0" },
    { "command": "node_modules/.bin/prettier --check $(git diff --name-only) tests/fixtures/UiHardeningHarness.svelte tests/fixtures/ui-hardening.html tests/fixtures/ui-hardening.ts tests/ui-hardening.chromium.mjs", "result": "passed", "summary": "All matched files use Prettier code style!" },
    { "command": "node_modules/.bin/tsc --noEmit", "result": "failed", "summary": "Known excluded node-duel-worker-harness.ts:96 TS2345 only" },
    { "command": "node_modules/.bin/svelte-check --tsconfig ./tsconfig.json", "result": "failed", "summary": "Same fixture error, four unrelated warnings" },
    { "command": "git diff --check", "result": "passed", "summary": "No whitespace errors" },
    { "command": "git diff --cached --name-only | wc -l", "result": "passed", "summary": "0 staged paths" }
  ],
  "validationOutput": [
    "Baseline final regressions: 10 failed | 96 passed; Chromium 4 failed",
    "Fixed expanded run: Test Files 10 passed (10); Tests 397 passed (397)",
    "Fixed Chromium: E1, F2 nonportaled, F2 portaled, F3 passed twice consecutively"
  ],
  "residualRisks": [
    "Known excluded fixture TS2345 blocks full type gates",
    "Two intermediate first-shop-tile browser timeouts; cause uncertain; later three runs passed",
    "Fresh reviewer gate pending; full build/real-WASM browser run not performed",
    "Unassigned ChainStatus descendant-selector debt unchanged"
  ],
  "noStagedFiles": true,
  "diffSummary": "Eight narrow impl files; eleven mounted regressions plus four Chromium checks; no staging or commits.",
  "reviewFindings": [
    "No scoped blocker found in worker checks; independent review pending"
  ],
  "manualNotes": "Parent merges App.svelte failure-state hunks, PromptControls.svelte selector-only hunks separately from runtime followup. Fresh reviewer next. Scratch cleaned; recreate documented isolated Vitest setup before rerun."
}
```
