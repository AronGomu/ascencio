# T12: Duel result dialog

**Plan:** `./ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** none
**Commit outcome:** When a duel ends, the winner announcement, the "Start another duel" button and the diagnostics download move out of the page flow into a centred modal dialog.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is item 17.
- This slice: `src/app/App.svelte` renders the end-of-duel state as `<section class="message-panel result-panel" …>` inline in `<main>`, between the error panel and the duel row. It holds an eyebrow, a focusable `<h2>` bound to `resultHeading`, an outcome-specific detail paragraph, a restart button, a "Contains the production seed." note and a diagnostics button. The user wants that whole block to be a centred dialog.
- Out of scope here: the error panel (stays inline), the storage/image warning panels (stay inline), the diagnostics pipeline itself, restart behaviour, anything on the field.
- Assumptions in force:
  - **A11 (dialog style, carried from the 2026-08-08 plan)** dialogs are `div[role="dialog"][aria-modal="true"]` with a manual focus move, Escape handling and a backdrop — not native `<dialog>`. Match `src/app/components/SettingsDialog.svelte` and `src/app/components/MenuDialog.svelte`.

## Requirements

1. New component `src/app/components/DuelResultDialog.svelte`:
   ```svelte
   <script lang="ts">
     export let result: DuelResult;
     export let completed = false;
     export let diagnosticPending = false;
     export let onrestart: () => void;
     export let ondownloaddiagnostics: () => void;
   </script>
   ```
   - Renders `div.dialog-backdrop > div.dialog-panel[role="dialog"][aria-modal="true"][aria-labelledby="duel-result-heading"]`.
   - Moves the existing markup verbatim: the `Duel complete` eyebrow, the `<h2 id="duel-result-heading" tabindex="-1">` with the four outcome branches (`completed` → `You won` / `Opponent won`, `surrendered` → `Duel surrendered`, `unsupported` → `Unsupported duel message`, else `Engine error`), the three detail paragraphs, the restart button, the sensitive-seed note and the diagnostics button.
   - **There is no close button and the backdrop does not dismiss.** A finished duel has no "behind" to return to; the only exits are restarting or downloading diagnostics. Do not wire Escape either.
   - `onMount` focuses the heading (`heading?.focus()`), replacing the `resultHeading?.focus()` that `afterUpdate` does in `App.svelte` today.
   - Keeps `role="status" aria-live="polite" aria-atomic="true" aria-busy={!completed}` on the panel so the outcome is still announced.
2. `src/app/App.svelte`:
   - Deletes the whole `{#if $duel.result} <section class="message-panel result-panel"> … </section> {/if}` block and renders, at the end of `<main>` next to the other dialogs:
     ```svelte
     {#if $duel.result}
       <DuelResultDialog
         result={$duel.result}
         completed={$duel.status === "completed"}
         {diagnosticPending}
         onrestart={() => void duel.restart()}
         ondownloaddiagnostics={requestDiagnostics}
       />
     {/if}
     ```
   - Deletes `let resultHeading: HTMLHeadingElement;` and the `if ($duel.status === "completed" && previousStatus !== "completed") resultHeading?.focus();` lines from `afterUpdate`. **Keep** `previousStatus` and its assignment if anything else reads it; if nothing does, delete both.
3. Every `data-cy` value in the moved markup is preserved **exactly** so existing unit, component and e2e assertions keep working: `app-result-panel`, `app-result-body`, `app-result-eyebrow`, `app-result-heading`, `app-result-finish-reason`, `app-result-unsupported-detail`, `app-result-engine-error-detail`, `app-result-actions`, `app-restart-duel-button`, `app-result-sensitive-note`, `app-result-download-diagnostics-button`. Two new values are added: `duel-result-dialog-backdrop` on the backdrop and `duel-result-dialog` on the panel. `app-result-panel` moves onto the same element as `duel-result-dialog`? **No** — one `data-cy` per element. Put `duel-result-dialog-backdrop` on the backdrop `<div>`, `duel-result-dialog` on the `.dialog-panel` `<div>`, and keep `app-result-panel` on an inner `<section class="result-panel">` that wraps the moved body and actions.
4. `src/styles/app.css` — `.result-panel` keeps its existing rules; add `.dialog-panel .result-panel { border: none; background: none; padding: 0; }` if the nested panel double-draws a border. Do not restyle `.dialog-backdrop` or `.dialog-panel`.
5. Every rendered element carries a unique kebab-case `data-cy`.

## Inputs

- `src/app/App.svelte` — the `{#if $duel.result}` block (currently around lines 775-842), `resultHeading`, `previousStatus`, `diagnosticPending`, `requestDiagnostics()`, `duel.restart()`, and the trailing `{#if menuOpen}` / `{#if settingsOpen}` dialog blocks that show where the new dialog goes.
- `src/app/components/SettingsDialog.svelte` — the `.dialog-backdrop` / `.dialog-panel` structure and the `onMount` focus pattern to copy. **Do not** copy its backdrop-click or Escape handlers.
- `src/app/components/MenuDialog.svelte` — second reference for the same structure.
- `src/duel/contracts/duel-result.ts` — `DuelResult` union: `completed` (with `winner`, `loser`, `reason`), `surrendered`, `unsupported` (with `detail`), `engineError` (with `detail`).
- `src/app/stores/duel-store.ts` — `DuelViewState.result`, `DuelViewState.status`, `restart()`.
- `src/styles/app.css` — `.dialog-backdrop`, `.dialog-panel`, `.result-panel`, `.message-panel`, `.button-row`, `.sensitive-note`.
- `tests/component/AppChrome.test.ts`, `tests/unit/data-cy-coverage.test.ts`, `e2e/duel-smoke.spec.ts` (it asserts on `app-result-heading` and `app-restart-duel-button`).
- **From Depends:** none.

## TDD

1. **Red** — add `tests/component/DuelResultDialog.test.ts` with the six cases below. Run `npm run test:component`; it must fail.
2. **Green** — create the component, move the markup, rewire `App.svelte`.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `announces a win` | `result={{ type: "completed", winner: 0, loser: 1, reason: 1 }}`, `completed={true}` | `app-result-heading` text is `You won`; `app-result-finish-reason` contains `1` |
| `announces a loss` | same with `winner: 1` | `app-result-heading` text is `Opponent won` |
| `announces a surrender` | `result={{ type: "surrendered" }}` | `app-result-heading` text is `Duel surrendered` |
| `renders inside a modal dialog` | any result | `duel-result-dialog` has `role="dialog"` and `aria-modal="true"`; `duel-result-dialog-backdrop` is present |
| `focuses the heading on mount` | any result | `document.activeElement` is `app-result-heading` |
| `restart and diagnostics fire their callbacks` | click `app-restart-duel-button`, then `app-result-download-diagnostics-button` | `onrestart` and `ondownloaddiagnostics` each called once |
| `disables restart until the duel is completed` | `completed={false}` | `app-restart-duel-button` is disabled and reads `Starting another duel…` |
| `disables diagnostics while pending` | `diagnosticPending={true}` | `app-result-download-diagnostics-button` is disabled and reads `Preparing diagnostics…` |
| `backdrop click does not dismiss` | click `duel-result-dialog-backdrop` | `duel-result-dialog` is still present |

## Impl steps

- [ ] 1. Create `tests/component/DuelResultDialog.test.ts` with the nine cases from the table.
- [ ] 2. Run `npm run test:component`; confirm it fails.
- [ ] 3. Create `src/app/components/DuelResultDialog.svelte` with the prop contract above, the backdrop/panel structure copied from `SettingsDialog.svelte` (minus its dismiss handlers), an `onMount` heading focus, and the result markup moved verbatim from `App.svelte` including every existing `data-cy`.
- [ ] 4. In `src/app/App.svelte`, delete the inline `{#if $duel.result}` section and add the `DuelResultDialog` block next to `{#if menuOpen}` / `{#if settingsOpen}`.
- [ ] 5. In `src/app/App.svelte`, delete `resultHeading` and the `afterUpdate` focus lines for it; delete `previousStatus` too if nothing else reads it.
- [ ] 6. In `src/styles/app.css`, add the nested `.dialog-panel .result-panel` reset if the border double-draws.
- [ ] 7. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`.
- [ ] 8. Run the chromium e2e suite (see Validation). The existing end-of-duel assertions should pass unchanged because every `data-cy` was preserved; if one fails on visibility, it is because the dialog needs a higher `z-index` than the field — fix the CSS, not the test.

## Outputs

- Added: `src/app/components/DuelResultDialog.svelte`, `tests/component/DuelResultDialog.test.ts`.
- Edited: `src/app/App.svelte`, `src/styles/app.css`.
- Public contract for successors: `DuelResultDialog` props are `result: DuelResult`, `completed: boolean`, `diagnosticPending: boolean`, `onrestart: () => void`, `ondownloaddiagnostics: () => void`. New `data-cy` values `duel-result-dialog-backdrop` and `duel-result-dialog`; every previous `app-result-*` value is unchanged.
- No migration, no config change.

## Validation

- [ ] `npm run format:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:unit` exits 0
- [ ] `npm run test:component` exits 0
- [ ] chromium e2e exits 0:
  ```bash
  cd /home/aron/projects/ascencio
  timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
    libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
    alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
  export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
  npx playwright test --project=chromium
  '
  ```
  **This exact command was verified green by the orchestrator on 2026-08-10** (`1 passed` on `-g "production bundle initializes"`). Run it verbatim from the repo root.
  - `PLAYWRIGHT_BROWSERS_PATH=.tmp/pw-browsers` is mandatory. That directory holds symlinks to the nix-patched browsers in `/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` under the revision names playwright 1.61 expects (`chromium-1228 -> chromium-1217`). The mismatched revision numbers are deliberate and fine.
  - Without the override, Playwright picks `~/.cache/ms-playwright`, whose binaries are unpatched and die with `libglib-2.0.so.0: cannot open shared object file`. That error means the override is missing, not that the `-p` list is wrong.
  - `playwright-driver.browsers` and `xorg.xvfb` are both required in the `-p` list even though Xvfb is never launched. Do not simplify the list.
  - If `.tmp/pw-browsers` is gone, recreate it: `S=/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` (rebuild with `nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link` if the path is garbage-collected), then `mkdir -p .tmp/pw-browsers && cd .tmp/pw-browsers && ln -sfn $S/chromium-1217 chromium-1228 && ln -sfn $S/chromium_headless_shell-1217 chromium_headless_shell-1228 && ln -sfn $S/ffmpeg-1011 ffmpeg-1011 && ln -sfn $S/firefox-1511 firefox-1532`.
  - Run it in the **foreground**, blocking. Runs take 1-5 min; `webServer` builds and starts the preview itself, so do not hand-start `npm run preview`.
  - The duel seed is random per run (`crypto.getRandomValues`). A single pass of a duel-walking test proves little; if a duel-walking test is the one you changed, run the suite 3 times before calling it green.
- [ ] manual check: `npm run dev`, surrender from the menu — a centred dialog announces the outcome, focus lands on its heading, and "Start another duel" works
- [ ] app functional — the page no longer reflows when a duel ends, and the error panel still renders inline
- [ ] commit msg draft: `feat(app): present the duel result in a centred dialog`
</content>
