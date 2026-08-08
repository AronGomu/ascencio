# T3: Remove app chrome panels

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T2
**Commit outcome:** `app-header`, `status-panel` and `lifecycle-panel` are gone, the duel field's stray heading and two live-region paragraphs are gone, screen-reader-only text is genuinely hidden, and loading progress shows as a slim overlay at the top of the viewport.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. This ticket deletes the panels the user called out (feedback items 2, 3, 4 and 6).
- This slice: deletion plus one small replacement component for loading progress. Surrender already moved to the menu dialog in T2, so nothing is lost by deleting `lifecycle-panel`.
- Out of scope here: board layout and scroll (T4), hiding `duel-hud` / `workspace-grid` (T5), `selection-dock` (T6), pills (T8). Leave those alone.
- Assumptions in force: A3 (engine version and snapshot ids now live only in the settings dialog), A10 (deleting the two field live regions removes those announcements on purpose; the app-level announcement region stays).

## Known defect this ticket must fix

`.visually-hidden` is declared **only** inside the scoped `<style>` block of `src/app/prompts/PromptControls.svelte` (around line 697). Svelte scopes it, so every other `.visually-hidden` element renders as plain visible text: the duel field heading, both field live paragraphs, `#duel-field-keyboard-help` in `FieldBoard.svelte`, the `DuelLog.svelte` live paragraph and the `App.svelte` announcement are all on screen today. That is why feedback item 6 exists. Promote the rule to the global sheet so the survivors are actually hidden.

## Requirements

- `header.app-header` deleted from `src/app/App.svelte`, with its CSS.
- `section.status-panel` deleted from `src/app/App.svelte`, with its CSS.
- `section.lifecycle-panel` deleted from `src/app/App.svelte`, with its CSS and its now-dead script state.
- In `src/app/components/DuelField.svelte`: `<h2 class="visually-hidden">Duel field</h2>`, the `aria-label="Field updates"` paragraph and the `aria-label="Duel state updates"` paragraph deleted, together with the reactive values and helper that fed them.
- `.visually-hidden` becomes a global utility in `src/styles/app.css`; the scoped copy in `PromptControls.svelte` is removed.
- Image preload / engine loading / snapshot activation progress renders in a new `LoadingOverlay.svelte` fixed to the top of the viewport.
- `message-panel` sections (storage warning, image warning, error, result) and the diagnostic message are untouched.
- E2E surrender flow goes through the menubar.

## Inputs

- Edit: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/app/prompts/PromptControls.svelte`, `src/styles/app.css`, `e2e/duel-smoke.spec.ts`, `tests/component/DuelField.test.ts`.
- Create: `src/app/components/LoadingOverlay.svelte`.
- **From Depends (T2):** `src/app/components/AppMenubar.svelte` renders `[data-cy="app-menubar"]` with `[data-cy="app-menubar-settings-button"]`. `src/app/components/MenuDialog.svelte` renders `[data-cy="menu-dialog-surrender-button"]`, `[data-cy="menu-dialog-surrender-confirm-button"]`, `[data-cy="menu-dialog-surrender-cancel-button"]`. `src/app/components/SettingsDialog.svelte` renders `[data-cy="settings-engine-version"]` containing `ocgcore 11.0` and `[data-cy="settings-active-snapshot"]`. `App.svelte` already holds `menuOpen`, `settingsOpen`, `openMenu()`, `closeMenu()`, `openSettings()`, `closeSettings()`. Every element carries `data-cy`, enforced by `tests/unit/data-cy-coverage.test.ts`.

## Exact API to create

```svelte
<!-- src/app/components/LoadingOverlay.svelte -->
export let label: string;
export let progress: number | null = null; // null renders an indeterminate <progress>
```

Renders `div.loading-overlay[role="status"][aria-live="polite"][data-cy="loading-overlay"]` holding `p[data-cy="loading-overlay-label"]` and `progress[data-cy="loading-overlay-progress"]`.

## TDD

1. **Red** — add the four component assertions below to `tests/component/DuelField.test.ts` and a new `tests/component/LoadingOverlay.test.ts`; run them and record failures (the DuelField ones fail because the elements still exist).
2. **Green** — delete markup, add the overlay, move the CSS rule.
3. **Refactor** — remove every symbol the deletions orphaned; `npm run lint` must report no unused variables.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `duel field has no heading` | render `DuelField` with a board fixture | `container.querySelector("h2")` is `null` |
| `duel field has no field-updates live region` | same | `container.querySelector('[aria-label="Field updates"]')` is `null` |
| `duel field has no duel-state live region` | same | `container.querySelector('[aria-label="Duel state updates"]')` is `null` |
| `duel field still renders the board` | same | `[data-cy="duel-field-board"]` present |
| `loading overlay shows a determinate bar` | `label: "Preparing active card images", progress: 0.5` | `[data-cy="loading-overlay-progress"]` has `value === 0.5` and `max === 1` |
| `loading overlay shows an indeterminate bar` | `progress: null` | `[data-cy="loading-overlay-progress"]` has no `value` attribute |
| `visually hidden text is clipped` (jsdom style check) | render `DuelLog` | computed `position` of `.visually-hidden` is `absolute` after importing `src/styles/app.css` — if importing global CSS in jsdom is impractical, assert instead that `src/styles/app.css` contains a `.visually-hidden` rule with `clip: rect(0 0 0 0)` via a `tests/unit/global-styles.test.ts` file read |
| e2e `production bundle initializes …` | production build | engine version is asserted through the settings dialog, not the page body |
| e2e surrender flows | production build | surrender runs through menubar → menu dialog → confirm |

## Impl steps

- [ ] 1. Add the four DuelField assertions to `tests/component/DuelField.test.ts` inside the existing describe block that renders a board; run `npx vitest run tests/component/DuelField.test.ts` and record the three failures.
- [ ] 2. Create `tests/component/LoadingOverlay.test.ts` (`// @vitest-environment jsdom`) with the two overlay rows; record the module-not-found failure.
- [ ] 3. Create `tests/unit/global-styles.test.ts` asserting `readFileSync("src/styles/app.css", "utf8")` contains `.visually-hidden` and `clip: rect(0 0 0 0)`; record the failure.
- [ ] 4. Create `src/app/components/LoadingOverlay.svelte` per the API above; when `progress === null` render `<progress data-cy="loading-overlay-progress" aria-label={label}></progress>`, otherwise render it with `value={progress} max="1"`.
- [ ] 5. In `src/styles/app.css`, add a global `.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }` rule directly after the `:focus-visible` rule.
- [ ] 6. In `src/styles/app.css`, add `.loading-overlay { position: fixed; z-index: var(--duel-field-layer-menu); top: 0; left: 50%; display: grid; gap: .25rem; width: min(24rem, calc(100% - 1rem)); padding: .5rem .75rem; border: 1px solid var(--border); border-top: 0; border-radius: 0 0 .6rem .6rem; background: color-mix(in srgb, var(--surface) 94%, transparent); transform: translateX(-50%); }` and `.loading-overlay p { margin: 0; color: var(--muted); font-size: .78rem; }`.
- [ ] 7. Delete the scoped `.visually-hidden` rule from the `<style>` block of `src/app/prompts/PromptControls.svelte`.
- [ ] 8. In `src/styles/app.css`, delete the `.app-header` block, remove `.app-header` from the `.app-header, main { … }` selector list (leaving `main { … }`), and remove `.app-header` from the `@media (max-width: 38rem)` selector list.
- [ ] 9. In `src/styles/app.css`, remove `.status-panel` and `.lifecycle-panel` from every selector list that names them (the shared panel-chrome rule, the flex rule, the padding rule, the `h2` rule, the `@media (max-width: 38rem)` list) and delete the `.lifecycle-panel, .button-row { … }` rule's `.lifecycle-panel` selector plus the `.lifecycle-panel p { … }` rule. Keep `.button-row`, `.message-panel`, `.prompt-panel`, `.event-log`, `.loading-state`, `.duel-hud`, `.card-inspector` behaviour identical.
- [ ] 10. In `src/app/App.svelte`, delete the whole `<header class="app-header"> … </header>` block.
- [ ] 11. In `src/app/App.svelte`, delete the whole `<section class="status-panel" …> … </section>` block, including the two `loading-state` branches inside it.
- [ ] 12. In `src/app/App.svelte`, delete the whole `{#if ($duel.status === "active" || …)} <section class="lifecycle-panel" …> … </section> {/if}` block.
- [ ] 13. In `src/app/App.svelte`, delete the now-unused script members: `confirmingSurrender`, `surrenderTrigger`, `surrenderConfirm`, `openSurrenderConfirmation()`, `cancelSurrenderConfirmation()`.
- [ ] 13a. Keep the `afterUpdate` generation memo. `surrenderContext` is the memo variable that resets `diagnosticPending` and `inspectedCard` when the worker or session generation changes — it is **not** dead. Rename it to `generationContext` and delete only the `confirmingSurrender = false;` line inside the `if` body. The block must stay:

  ```ts
  const context = `${$duel.context.workerGeneration}:${$duel.context.sessionGeneration}`;
  if (context !== generationContext) {
    generationContext = context;
    diagnosticPending = false;
    inspectedCard = null;
  }
  ```
- [ ] 14. In `src/app/App.svelte`, simplify `appAnnouncement` so the `confirmingSurrender` ternary collapses to `"Response sent. Waiting for the engine"`.
- [ ] 15. In `src/app/App.svelte`, simplify the `prompt-panel` empty copy so its `confirmingSurrender` ternary collapses to `"Your response was sent. Waiting for the engine…"`.
- [ ] 16. In `src/app/App.svelte`, import `LoadingOverlay` and render, as the first child of `<main>`: `{#if imageLoading}<LoadingOverlay label="Preparing active card images" progress={imageProgress} />{:else if snapshotActivationPending}<LoadingOverlay label="Activating verified snapshot" />{:else if $duel.loading}<LoadingOverlay label={\`Loading ${phaseLabel($duel.loading.stage)}\`} progress={$duel.loading.progress ?? null} />{/if}`.
- [ ] 17. In `src/app/components/DuelField.svelte`, delete `<h2 class="visually-hidden">Duel field</h2>` and both `<p class="visually-hidden" aria-label="…">` blocks.
- [ ] 18. In `src/app/components/DuelField.svelte`, delete the reactive statements `$: fieldAnnouncement = …` and `$: duelStateAnnouncement = …`, and delete the `stateAnnouncement()` function.
- [ ] 19. Run `npx vitest run tests/component/DuelField.test.ts tests/component/LoadingOverlay.test.ts tests/unit/global-styles.test.ts` to green.
- [ ] 20. In `e2e/duel-smoke.spec.ts`, add a module-level helper `async function surrenderThroughMenu(page: Page): Promise<void>` that clicks `[data-cy="app-menubar-settings-button"]`, then `[data-cy="menu-dialog-surrender-button"]`, then `[data-cy="menu-dialog-surrender-confirm-button"]`.
- [ ] 21. In `e2e/duel-smoke.spec.ts`, replace every `page.getByRole("button", { name: "Surrender duel" }).click()` plus following `Confirm surrender` click with `await surrenderThroughMenu(page)`; replace the `Keep playing` interaction in the `repeated restart replaces the Worker` test with `[data-cy="menu-dialog-surrender-cancel-button"]` and reopen the menu before confirming.
- [ ] 22. In `e2e/duel-smoke.spec.ts`, replace `await expect(page.getByText("ocgcore 11.0")).toBeVisible();` with: open the menubar settings button, click `[data-cy="menu-dialog-settings-button"]`, assert `[data-cy="settings-engine-version"]` has text matching `/ocgcore 11\.0/`, then click `[data-cy="settings-dialog-close-button"]`.
- [ ] 23. Run `npx playwright test -g "production bundle initializes"` and `npx playwright test -g "repeated restart replaces the Worker"` to green, then the full `npm run test:e2e`.

## Outputs

- Files created: `src/app/components/LoadingOverlay.svelte`, `tests/component/LoadingOverlay.test.ts`, `tests/unit/global-styles.test.ts`.
- Files edited: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/app/prompts/PromptControls.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- Behaviour change: no page header, no status panel, no lifecycle panel; surrender only via the menu; screen-reader-only strings no longer visible.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/component/DuelField.test.ts tests/component/LoadingOverlay.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes with no unused-symbol warnings
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run test:e2e` passes
- [ ] manual check: `npm run dev` shows no page title bar, no session-status card, no surrender panel, no stray "Duel field"/"Field updates"/"Duel state updates" text; loading progress appears as a bar pinned to the top of the window
- [ ] app functional — duel starts, prompts answerable, surrender works from the menu
- [ ] commit msg draft: `refactor(app): drop header, status and lifecycle chrome`
