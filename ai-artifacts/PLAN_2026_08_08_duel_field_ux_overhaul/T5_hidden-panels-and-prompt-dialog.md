# T5: Hidden panels by default + prompt dialog

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T2
**Commit outcome:** `duel-hud` and `workspace-grid` are hidden until their settings checkbox is ticked, and any prompt that cannot be answered on the field opens a modal prompt dialog over the field so the duel never stalls.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. This ticket covers feedback item 8 and closes the hole it opens.
- This slice: conditional rendering driven by the settings store, one new modal component, and one new pure routing function.
- Why the dialog: hiding `workspace-grid` hides `PromptControls`, the only UI for `yesNo`, `effectYesNo`, `option`, `selectPosition`, `announceNumber`, `announceAttribute`, `announceRace`, `announceCard`, `rockPaperScissors`, `sortCard` and `sortChain`. Without a replacement surface the engine waits forever.
- Out of scope here: `selection-dock` removal (T6), end-turn button (T7), pills (T8), chips (T9), drag (T10), preview (T11). Field-capable prompts keep using the existing `SelectionDock` in this ticket.
- Assumptions in force: A2 (settings are in-memory), A11 (hand-rolled dialog markup).

## Requirements

- `DuelHud` renders only when `showDuelHud` is true. Default hidden.
- `div.workspace-grid` (prompt panel + duel log) renders only when `showWorkspace` is true. Default hidden.
- A new pure function decides where a prompt is answered; `App.svelte` contains no ad-hoc boolean chain.
- When the routing says `dialog`, `PromptDialog` renders `PromptControls` in a modal over everything.
- The prompt dialog has **no** close button, ignores `Escape` and ignores backdrop clicks: the engine is waiting for an answer and there is nothing to dismiss to. Cancelling, when legal, is one of the prompt's own choices.
- The prompt dialog focuses its first control on mount.
- Never two prompt surfaces at once: with the workspace visible the docked panel wins and no dialog renders.
- `section.duel-field` carries `data-prompt-kind` while a prompt is active so tests have one stable readiness selector.

## Inputs

- Edit: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/styles/app.css`, `e2e/duel-smoke.spec.ts`.
- Create: `src/app/prompts/prompt-surface.ts`, `src/app/components/PromptDialog.svelte`, `tests/unit/prompt-surface.test.ts`, `tests/component/PromptDialog.test.ts`.
- **From Depends (T2):** `src/app/stores/ui-settings-store.ts` exports `createUiSettingsStore()`, `UiSettingsState { showDuelHud: boolean; showWorkspace: boolean }`, `DEFAULT_UI_SETTINGS` (both `false`), and setters `setShowDuelHud(value)` / `setShowWorkspace(value)`. `App.svelte` already holds `const uiSettings = createUiSettingsStore();` and passes `$uiSettings` into `SettingsDialog` with `onshowduelhud` / `onshowworkspace` wired to the setters. `SettingsDialog` renders `[data-cy="settings-show-duel-hud-checkbox"]` and `[data-cy="settings-show-workspace-checkbox"]`; the menubar button is `[data-cy="app-menubar-settings-button"]` and the menu's settings entry is `[data-cy="menu-dialog-settings-button"]`.
- Read only: `src/app/prompts/interaction-spec.ts` (`InteractionSpec`, `ActiveInteractionSpec.fieldCapable`, `{ kind: "inactive" }`), `src/app/prompts/PromptControls.svelte` (props `prompt`, `disabled`, `onsubmit`, `imageLibrary`, `placeholderUrl`; root element carries `data-prompt-kind`).

## Exact API to create

```ts
// src/app/prompts/prompt-surface.ts
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type { InteractionSpec } from "./interaction-spec.ts";

export type PromptSurface = "none" | "docked" | "field" | "dialog";

export function promptSurface(
  prompt: PlayerPrompt | null,
  spec: InteractionSpec | null,
  showWorkspace: boolean,
): PromptSurface;
```

Rules, in order: `prompt === null` → `"none"`; `showWorkspace` → `"docked"`; `spec !== null && spec.kind !== "inactive" && spec.fieldCapable` → `"field"`; otherwise → `"dialog"`.

```svelte
<!-- src/app/components/PromptDialog.svelte -->
export let prompt: PlayerPrompt;
export let disabled = false;
export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
export let placeholderUrl = "";
export let onsubmit: (choiceIds: readonly ChoiceId[]) => unknown;
```

## data-cy contract added here

`prompt-dialog-backdrop`, `prompt-dialog`.

## TDD

1. **Red** — write `tests/unit/prompt-surface.test.ts` and `tests/component/PromptDialog.test.ts` first; record module-not-found failures.
2. **Green** — add the function, the component, then the `App.svelte` conditionals.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `no prompt means no surface` | `promptSurface(null, null, false)` | `"none"` |
| `visible workspace docks the prompt` | any prompt, any spec, `showWorkspace: true` | `"docked"` |
| `field-capable prompt stays on the field` | prompt + spec with `fieldCapable: true`, `showWorkspace: false` | `"field"` |
| `non-field prompt opens the dialog` | prompt + spec with `kind: "nonField"`, `fieldCapable: false` | `"dialog"` |
| `inactive spec opens the dialog` | prompt + `{ kind: "inactive" }` | `"dialog"` |
| `null spec opens the dialog` | prompt + `null` | `"dialog"` |
| `dialog hosts the prompt controls` | render `PromptDialog` with a `yesNo` prompt | `[data-cy="prompt-dialog"]` contains an element with `data-prompt-kind="yesNo"` |
| `dialog has no dismiss affordance` | same | no button whose accessible name matches `/close/i` inside `[data-cy="prompt-dialog"]` |
| `dialog ignores escape` | press `Escape` | `[data-cy="prompt-dialog"]` still in the document |
| `dialog ignores backdrop clicks` | click `[data-cy="prompt-dialog-backdrop"]` | `[data-cy="prompt-dialog"]` still in the document |
| `dialog focuses its first control` | mount | `document.activeElement` is inside `[data-cy="prompt-dialog"]` |
| `dialog forwards submissions` | click the `Yes` choice then submit | `onsubmit` called once with that choice id |
| e2e `hidden panels by default` | production build | `[data-cy="duel-hud"]` and `[data-cy="workspace-grid"]` are absent on load |
| e2e `settings reveal the panels` | tick both checkboxes | both selectors become visible |

## Impl steps

- [ ] 1. Create `tests/unit/prompt-surface.test.ts` with the first six rows; run `npx vitest run tests/unit/prompt-surface.test.ts` and record the failure.
- [ ] 2. Create `src/app/prompts/prompt-surface.ts` exactly as specified; re-run to green.
- [ ] 3. Create `tests/component/PromptDialog.test.ts` (`// @vitest-environment jsdom`) with the six component rows; record failures.
- [ ] 4. Create `src/app/components/PromptDialog.svelte`: `div.dialog-backdrop[data-cy="prompt-dialog-backdrop"]` with **no** click handler, wrapping `div.dialog-panel[role="dialog"][aria-modal="true"][data-cy="prompt-dialog"]` whose `aria-label` is `prompt.title`, containing `<PromptControls {prompt} {disabled} {imageLibrary} {placeholderUrl} {onsubmit} />`.
- [ ] 5. In `PromptDialog.svelte`, `onMount` focus the first `button, input, select` inside the panel with `preventScroll: true`. Do not add a `svelte:window` keydown handler.
- [ ] 6. In `src/styles/app.css`, add `.prompt-dialog-panel { width: min(36rem, 100%); }` and apply that class alongside `dialog-panel` in `PromptDialog.svelte` so prompt lists have room.
- [ ] 7. Run `npx vitest run tests/component/PromptDialog.test.ts` to green.
- [ ] 8. In `src/app/App.svelte`, import `promptSurface` and `PromptDialog`, and add `$: currentPromptSurface = promptSurface($duel.prompt, mappedInteractionSpec, $uiSettings.showWorkspace);`.
- [ ] 9. In `src/app/App.svelte`, wrap the `<DuelHud … />` element in `{#if $uiSettings.showDuelHud}` … `{/if}`, keeping the existing `{:else if $duel.status === "active"}` "Preparing duel" branch attached to the `{#if $duel.snapshot}` test, not to the new one.
- [ ] 10. In `src/app/App.svelte`, wrap `<div class="workspace-grid" …>` … `</div>` in `{#if $uiSettings.showWorkspace}` … `{/if}`.
- [ ] 11. In `src/app/App.svelte`, render `{#if currentPromptSurface === "dialog" && $duel.prompt}{#key $duel.prompt.id}<PromptDialog prompt={$duel.prompt} disabled={$duel.responsePending} imageLibrary={imagesMatchRuntime ? imageLibrary : null} placeholderUrl={imageLibrary?.placeholderUrl ?? DEFAULT_CARD_PLACEHOLDER} onsubmit={duel.respond} />{/key}{/if}` after the duel-field block.
- [ ] 12. In `src/app/App.svelte`, keep `promptPanel` `bind:this` and `dismissRecoverableError()` working when the workspace is hidden: guard the focus call as `promptPanel?.focus()`.
- [ ] 13. In `src/app/components/DuelField.svelte`, add `data-prompt-kind={prompt === null ? undefined : prompt.kind}` to the root `section.duel-field`.
- [ ] 14. Run `npm run test:component`; repair any assertion that assumed the HUD or workspace is mounted.
- [ ] 15. In `e2e/duel-smoke.spec.ts`, add helpers `async function openSettingsDialog(page: Page)` (click `[data-cy="app-menubar-settings-button"]`, then `[data-cy="menu-dialog-settings-button"]`), `async function enableDuelHud(page: Page)` and `async function enableWorkspace(page: Page)` (open the dialog, check the matching checkbox, click `[data-cy="settings-dialog-close-button"]`).
- [ ] 16. In `e2e/duel-smoke.spec.ts`, replace every readiness wait `page.locator("[data-prompt-kind]")` with `page.locator('[data-cy="duel-field"][data-prompt-kind]')` (occurrences in the restart, refresh, lease, slow-image and placeholder tests).
- [ ] 17. In `e2e/duel-smoke.spec.ts`, replace the two `page.getByRole("region", { name: "Current decision" })` assertions in the `production bundle initializes …` test with assertions on `[data-cy="selection-dock"]` containing the heading text `Choose a Main Phase action`.
- [ ] 18. In `e2e/duel-smoke.spec.ts`, call `await enableDuelHud(page)` at the start of `duel HUD keeps hidden stacks count-only and tray image work mounted on demand`, `mounted card image leases return to baseline across tray, restart, and destroy` and any other test that reaches into `[data-cy="duel-hud"]` or a card tray.
- [ ] 19. In `e2e/duel-smoke.spec.ts`, add `test("panels stay hidden until settings enable them", …)` covering the last two test-plan rows.
- [ ] 20. Run `npm run test:e2e` to green.
- [ ] 21. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` and fix any new element missing `data-cy`.

## Outputs

- Files created: `src/app/prompts/prompt-surface.ts`, `src/app/components/PromptDialog.svelte`, `tests/unit/prompt-surface.test.ts`, `tests/component/PromptDialog.test.ts`.
- Files edited: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/styles/app.css`, `e2e/duel-smoke.spec.ts`.
- Behaviour change: HUD and workspace hidden by default; non-field prompts modal.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/prompt-surface.test.ts tests/component/PromptDialog.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run test:e2e` passes
- [ ] manual check: `npm run dev`, confirm no HUD and no bottom panels on load; play until a yes/no or position prompt appears and confirm the modal appears and answers it; tick both settings checkboxes and confirm both panels return
- [ ] app functional — a full duel can be completed with the panels hidden
- [ ] commit msg draft: `feat(app): hide side panels and route non-field prompts to a dialog`
