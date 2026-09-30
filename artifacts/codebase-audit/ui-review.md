# Independent UI review — six findings

## Review

- R1. **Done — scoped approval.** E1–E3/F1–F3 reviewed against mounted source, regressions, native Chromium. Two additional P2 defects within F1/F2 reproduced, fixed. Final: **468/468 tests**, **7/7 Chromium checks**, scoped lint/format/diff clean. Evidence: `ui-review-evidence/final-focused.log`, `final-chromium.log`, `final-lint.log`, `final-format.log`, `final-diff-check.log`.
- R2. **Fixed — P2/F2, dynamic modal escape.** Original isolation captured initial siblings only. Mounted App → Settings → workspace on created non-inert controls; workspace off created non-inert portaled PromptDialog, capable of stealing focus. Red: both new App cases failed `AssertionError: expected null not to be null`. Fix: live sibling observation, synchronous focus containment, owned-inert cleanup, Settings above later portals. `src/battle/app/components/SettingsDialog.svelte:44–98,105–123,293–297`. Regressions: `tests/component/AppChrome.test.ts:440–480`, `tests/component/SettingsDialog.test.ts:27–74`, Chromium dynamic portal/nonportal checks.
- R3. **Fixed — P2/F1, unreachable Retry.** Boundary retry remained behind new fallback modal. Chromium reproduced `locator.click: Timeout 3000ms exceeded.` Hit-test trace: `subtree intercepts pointer events` from `[data-cy="prompt-dialog-backdrop"]`. JSDOM click had missed this. Boundary now supplies presentation-only retry callback; fallback dialog exposes native Retry button. `src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte:38–41,75–80,116–119`; `src/battle/app/App.svelte:206–207,1225–1228,1291`; `src/battle/app/components/PromptDialog.svelte:48–55`. No legal response/engine changes. Chromium clicks reachable Retry → field restored, fallback removed, action count unchanged.
- R4. **Correct — lifecycle cleanup.** Repeated render failure yields callback states `[true, false, true]`; subsequent successful retry clears failure; unmount reports false. Raw error details stay hidden. `tests/component/DuelField.test.ts:2037–2117`; mounted App exact-choice fallback submission/recovery: `tests/component/AppChrome.test.ts:301–499`.
- R5. **Blocker — integration type gate only.** Final `tsc` still reports known excluded fixture error: `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.` Final `svelte-check`: `1 error and 4 warnings in 4 files`; same fixture error, pre-existing warnings. No scoped source/type errors remain. Parent applies existing root-owner fixture fix, merges distinct hunks, reruns integrated gates.

## Six-finding disposition

| ID | Disposition | Source / observed proof |
|---|---|---|
| E1 / P2 | Approved | `src/story/shop/ShopCardListScreen.svelte:127–139,154–158`: named focusable group independent of disabled Buy. Native Tab reaches second unaffordable card, preview text changes; Enter/Space purchases remain zero. `tests/component/story/ShopCardList.test.ts:264`; Chromium E1. |
| E2 / P3 | Approved within assigned sites | `src/battle/app/components/duel-field/DuelHud.svelte:84–245`: player/card/counter identity suffixes. `src/battle/app/prompts/PromptControls.svelte:349–403`: choice suffixes, order identity stable after reorder. Mounted uniqueness tests: `tests/component/DuelHud.test.ts:19`, `tests/component/PromptControls.test.ts:80`; static/rendered coverage gates pass. |
| E3 / P3 | Approved | `src/story/StoryApp.svelte:476–479,1102` passes existing canonical label from `src/story/handoff/story-handoff.ts:65–70`. Reward acknowledgement → Archive selection → briefing title, locked seat, handoff all `Archive echo`; Old Arena retained. `tests/component/story/pre-battle-deck-picker.test.ts:502–539`. |
| F1 / P2 | Approved after R3 | `App.svelte:357–361` gates field availability with boundary state. Boundary catches/render-retries/unmounts coherently. Fallback submits exact opaque choice; reachable dialog Retry restores field without response. Repeated-failure regression passes. |
| F2 / P2 | Approved after R2 | Native Tab/Shift+Tab containment, attempted background `.focus()`, Enter/Space isolation, dynamic workspace/portal isolation, later-portal pointer layering, trigger restoration verified. Existing inert ownership survives teardown; observer/focus listener no longer affect later controls. |
| F3 / P3 | Approved | `src/styles/app.css:2584–2598,2793–2796,2819–2822`: decorative card/art/material vars only. Chromium computed shadows off → all `none`; legal/selected shadows byte-identical across toggle; focus-visible outline remains; re-enable restores originals. |

## Validation

- V1. Final focused cmd:

```bash
NODE_OPTIONS=--no-experimental-webstorage node_modules/.bin/vitest run --config .tmp/ui-review-vitest.config.ts tests/component/SettingsDialog.test.ts tests/component/DuelHud.test.ts tests/component/PromptControls.test.ts tests/component/PromptDialog.test.ts tests/component/AppChrome.test.ts tests/component/story/ShopCardList.test.ts tests/component/story/pre-battle-deck-picker.test.ts tests/component/DuelField.test.ts tests/component/FieldBoard.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/domain-boundaries.test.ts tests/unit/global-styles.test.ts
```

- V2. Output: `Test Files  12 passed (12)`; `Tests  468 passed (468)`. Log: `/home/aron/Projects/ascencio/artifacts/codebase-audit/ui-review-evidence/final-focused.log`.
- V3. `node tests/ui-hardening.chromium.mjs` → seven PASS: E1; F2 static false/true portal; F2 dynamic false/true portal; F1 reachable retry; F3 computed shadows. Strict port `4517`, process-specific Vite cache, `preserveSymlinks`, local-only requests. Final log: `ui-review-evidence/final-chromium.log`.
- V4. `node_modules/.bin/eslint $(git diff --name-only -- '*.ts' '*.svelte') tests/fixtures/UiHardeningHarness.svelte tests/fixtures/ui-hardening.ts tests/ui-hardening.chromium.mjs` → exit 0. `node_modules/.bin/prettier --check $(git diff --name-only) tests/fixtures/UiHardeningHarness.svelte tests/fixtures/ui-hardening.html tests/fixtures/ui-hardening.ts tests/ui-hardening.chromium.mjs` → `All matched files use Prettier code style!`.
- V5. `node_modules/.bin/tsc --noEmit`; `node_modules/.bin/svelte-check --tsconfig ./tsconfig.json` → R5 only. Intermediate new test typing errors corrected: explicit throwing getter return type, required `cancelable: false`; final logs retain only excluded fixture error.
- V6. `node_modules/.bin/playwright test --list --grep 'injected DOM field failure'` → `Total: 2 tests in 1 file`. Updated real-WASM smoke cases **listed, not executed**. `e2e/duel-smoke.spec.ts:1497–1562` removes inaccessible Settings/workspace workaround; separates fallback-response assertion from retry-without-response assertion.
- V7. `git diff --check` → exit 0; `git diff --cached --name-only` → empty. Final `ss -ltn 'sport = :4517'` → header only. No commits/staging/deps/vendor changes.
- V8. Initial isolated suite: 396 pass, one missing generated fixture: `Error: ENOENT: no such file or directory, open 'generated/asset-delivery/prepared-player.json'`. Temporary `generated -> ../../generated` symlink enabled complete rerun. One intermediate browser navigation timed out before mounting: `locator.click: Timeout 30000ms exceeded.` Cause unconfirmed; later seven-check runs passed. Browser runner now retains page-error/HTTP diagnostics.
- V9. Final batch wrapper hit external 240-second cmd limit after focused/Chromium/tsc completed, during `svelte-check`. No lingering owned process found. Remaining checks rerun separately; cleanup completed. Logs: `ui-review-evidence/final-*.log`; earlier evidence retained.

## Assumptions / scope

- A1. Six specified findings define acceptance; no broad UI/WCAG/perf score claimed. Read `AGENTS.md`, worker/even/odd reports, Impeccable skill/context/audit/harden/craft-floor guidance. Incumbent visual design preserved.
- A2. `graphify query` unavailable: `/bin/bash: line 1: graphify: command not found`. Direct source traces substituted.
- A3. Chromium fixture mounts actual ShopCardListScreen, SettingsDialog, FieldBoard, DuelFieldErrorBoundary, PromptDialog with real CSS. App/StoryApp lifecycle tests mount real hosts with mocked worker/catalog. Not equivalent to integrated real-WASM E2E.
- A4. Node26 JSDOM config/stale cancel-controls/editor-import repairs belong separate worker. `NODE_OPTIONS=--no-experimental-webstorage` used locally only. Known fixture repair not copied. Parent steering respected: existing `pre-battle-deck-picker.test.ts:158,162` selector correction left untouched; Archive additions preserved.

## Files / merge overlap

Reviewer touched these ten paths beyond incoming worker diff:

- C1. `src/battle/app/App.svelte` — hold/pass recovery callback only beyond worker failure flag.
- C2. `src/battle/app/components/PromptDialog.svelte` — optional recovery button.
- C3. `src/battle/app/components/SettingsDialog.svelte` — dynamic isolation/focus containment/cleanup/portal stacking.
- C4. `src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte` — pass boundary retry callback.
- C5. `tests/component/AppChrome.test.ts` — dynamic modal regressions; use reachable fallback Retry.
- C6. `tests/component/SettingsDialog.test.ts` — pre-existing inert preservation; post-unmount focus/observer cleanup.
- C7. `tests/component/DuelField.test.ts` — failed retry/recovery/unmount notifications.
- C8. `tests/fixtures/UiHardeningHarness.svelte` — dynamic prompt/workspace, boundary-recovery scenarios.
- C9. `tests/ui-hardening.chromium.mjs` — dynamic modal/native retry checks, diagnostics, unique cache.
- C10. `e2e/duel-smoke.spec.ts` — F1 tests near 1497 only. Acceptance worker owns URL teardown ~1344, DF16 ~4964/helpers; merge distinct hunks.

Incoming worker paths additionally retained unchanged by reviewer:

- W1. `src/battle/app/components/duel-field/DuelHud.svelte`.
- W2. `src/battle/app/prompts/PromptControls.svelte`.
- W3. `src/story/StoryApp.svelte`.
- W4. `src/story/shop/ShopCardListScreen.svelte`.
- W5. `src/styles/app.css`.
- W6. `tests/component/DuelHud.test.ts`.
- W7. `tests/component/PromptControls.test.ts`.
- W8. `tests/component/story/ShopCardList.test.ts`.
- W9. `tests/component/story/pre-battle-deck-picker.test.ts`.
- W10. `tests/fixtures/ui-hardening.html`.
- W11. `tests/fixtures/ui-hardening.ts`.

## Residual risks / next action

- N1. No unresolved scoped correctness blocker found. Integration type gate remains R5. Parent: merge listed hunks preserving runtime followup, Decks selector correction, acceptance-worker smoke hunks; rerun focused cmd plus integrated type gates.
- N2. Real-WASM smoke execution pending. Exact next cmd in integrated root: `node_modules/.bin/playwright test e2e/duel-smoke.spec.ts --project=chromium --grep 'injected DOM field failure'`. Full build/full corpus/screenshots/screen-reader audit not run here.
- N3. Unassigned ChainStatus descendant-selector debt remains, as documented by incoming worker. E2 approval covers DuelHud-owned repeated descendants, multiple/order prompts; no whole-document uniqueness claim for all chain states.
- N4. One intermediate browser mount timeout remains unexplained; final Chromium passed. No hidden retry added.
- N5. Scratch removed: own `generated` symlink; `.tmp/ui-review-vitest.config.ts`; validation scripts `.tmp/ui-review-validate.mjs`, `.tmp/ui-review-final.mjs`; `.tmp/ui-review-vitest-cache`; this review's `.tmp/ui-hardening-vite-cache` plus this review's process-specific PID-suffixed caches. Root generated target untouched. Final `.tmp` empty; pre-existing `node_modules` symlink preserved. Deliverable report/evidence retained. Writes stop after report verification.

```acceptance-report
{
  "criteriaSatisfied": [
    { "id": "criterion-1", "status": "satisfied", "evidence": "Six findings independently reviewed with source refs. P2 F2 dynamic isolation escape reproduced/fixed; P2 F1 behind-modal Retry reproduced/fixed. 468 focused tests, seven native Chromium checks pass." }
  ],
  "changedFiles": [
    "src/battle/app/App.svelte",
    "src/battle/app/components/PromptDialog.svelte",
    "src/battle/app/components/SettingsDialog.svelte",
    "src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte",
    "tests/component/AppChrome.test.ts",
    "tests/component/SettingsDialog.test.ts",
    "tests/component/DuelField.test.ts",
    "tests/fixtures/UiHardeningHarness.svelte",
    "tests/ui-hardening.chromium.mjs",
    "e2e/duel-smoke.spec.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/component/AppChrome.test.ts",
    "tests/component/SettingsDialog.test.ts",
    "tests/component/DuelField.test.ts",
    "tests/fixtures/UiHardeningHarness.svelte",
    "tests/ui-hardening.chromium.mjs",
    "e2e/duel-smoke.spec.ts"
  ],
  "commandsRun": [
    { "command": "NODE_OPTIONS=--no-experimental-webstorage node_modules/.bin/vitest run --config .tmp/ui-review-vitest.config.ts tests/component/SettingsDialog.test.ts tests/component/DuelHud.test.ts tests/component/PromptControls.test.ts tests/component/PromptDialog.test.ts tests/component/AppChrome.test.ts tests/component/story/ShopCardList.test.ts tests/component/story/pre-battle-deck-picker.test.ts tests/component/DuelField.test.ts tests/component/FieldBoard.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/domain-boundaries.test.ts tests/unit/global-styles.test.ts", "result": "passed", "summary": "468 tests; 12 files" },
    { "command": "node tests/ui-hardening.chromium.mjs", "result": "passed", "summary": "Seven checks; port 4517 released" },
    { "command": "node_modules/.bin/tsc --noEmit", "result": "failed", "summary": "Known excluded fixture TS2345 only" },
    { "command": "node_modules/.bin/svelte-check --tsconfig ./tsconfig.json", "result": "failed", "summary": "Same fixture error; four pre-existing warnings" },
    { "command": "Scoped ESLint/Prettier commands in V4", "result": "passed", "summary": "Exit 0; all matched files formatted" },
    { "command": "node_modules/.bin/playwright test --list --grep 'injected DOM field failure'", "result": "passed", "summary": "Two smoke cases collected; not executed" },
    { "command": "git diff --check; git diff --cached --name-only", "result": "passed", "summary": "Clean whitespace; zero staged paths" }
  ],
  "validationOutput": [
    "Test Files 12 passed (12); Tests 468 passed (468)",
    "Chromium: seven PASS checks",
    "Final tsc/svelte-check retain excluded node-duel-worker-harness.ts:96 error only"
  ],
  "residualRisks": [
    "Integrated type gates require existing root-owner fixture fix",
    "Real-WASM smoke cases updated/listed, not executed",
    "One intermediate mount timeout; final browser checks pass",
    "Unassigned ChainStatus selector debt unchanged"
  ],
  "noStagedFiles": true,
  "diffSummary": "Reviewer adds two narrow presentation/lifecycle fixes within F1/F2, six regression paths; incoming six-finding worker diff preserved. No engine/legal-response/config/deps/vendor changes.",
  "reviewFindings": [
    "P2 fixed: SettingsDialog.svelte:44-98 initial-only inert isolation missed dynamic workspace/portaled prompts",
    "P2 fixed: PromptDialog.svelte:48-55 exposes boundary Retry previously intercepted by fallback backdrop",
    "No unresolved scoped blocker; known excluded fixture blocks aggregate type gate"
  ],
  "manualNotes": "Merge distinct smoke hunks only; leave root Decks selector correction to harness worker. Final evidence under artifacts/codebase-audit/ui-review-evidence/. Scratch cleaned; no commits/staging. Scope approved, integrated gates pending."
}
```
