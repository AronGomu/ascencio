# T2: Header menubar, menu dialog, settings dialog

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T1
**Commit outcome:** A header menubar with a right-justified `Settings` button opens a menu dialog holding a neutral grey `Settings` button and a red danger `Surrender` button; the Settings button opens a settings dialog with two visibility checkboxes plus engine and snapshot info.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. This ticket builds the only chrome that survives, so the next ticket can delete the old chrome without losing surrender or diagnostics.
- This slice: three new components plus one new store, wired into `src/app/App.svelte` **above** the existing `header.app-header`. Old chrome stays for now.
- Out of scope here: deleting `app-header`, `status-panel`, `lifecycle-panel` (T3); actually hiding `duel-hud` / `workspace-grid` (T5 reads the store this ticket creates); any duel-field change.
- Assumptions in force: A2 (settings are in-memory, no persistence), A3 (engine version and snapshot ids move into the settings dialog), A11 (dialogs are `div[role="dialog"][aria-modal="true"]`, not native `<dialog>`).

## Requirements

- New store `createUiSettingsStore()` with two booleans, both `false` by default.
- `AppMenubar.svelte`: full-width bar, single `Settings` button pushed to the right edge.
- `MenuDialog.svelte`: modal, contains a neutral grey `Settings` button and a danger red `Surrender` button, plus a `Close` button. Surrender runs a two-step confirm inside the dialog.
- `SettingsDialog.svelte`: modal, contains checkbox `Show duel HUD`, checkbox `Show workspace panels`, a read-only engine version line and a read-only active/fallback snapshot line, plus a `Close` button.
- Both dialogs: focus the first control on open, close on `Escape`, close on backdrop click, return focus to the control that opened them.
- Surrender from the menu produces exactly one `surrender` command, same as the existing panel.
- Every new element carries `data-cy` (T1 rule) and the new static values are unique.

## Inputs

- Read: `src/app/App.svelte` (surrender flow at `openSurrenderConfirmation`, `cancelSurrenderConfirmation`, `duel.surrender()`; `$duel.coreVersion`; `snapshotStorageStatus`), `src/app/stores/duel-store.ts` (`DuelStore.surrender(): boolean`, `DuelViewState.responsePending`, `status`, `result`), `src/styles/app.css` (button variants at lines 49–78).
- **From Depends (T1):** every existing element already carries `data-cy`; `tests/unit/data-cy-coverage.test.ts` and `tests/fixtures/svelte-element-scan.ts` exist and must stay green. `App.svelte`'s root elements are `data-cy="app-header"` and `data-cy="app-main"`.

## Exact API to create

```ts
// src/app/stores/ui-settings-store.ts
import { writable, type Readable } from "svelte/store";

export interface UiSettingsState {
  readonly showDuelHud: boolean;
  readonly showWorkspace: boolean;
}

export interface UiSettingsStore extends Readable<UiSettingsState> {
  setShowDuelHud(value: boolean): void;
  setShowWorkspace(value: boolean): void;
  reset(): void;
}

export const DEFAULT_UI_SETTINGS: UiSettingsState = Object.freeze({
  showDuelHud: false,
  showWorkspace: false,
});

export function createUiSettingsStore(
  initial: UiSettingsState = DEFAULT_UI_SETTINGS,
): UiSettingsStore;
```

```svelte
<!-- src/app/components/AppMenubar.svelte -->
export let onopensettings: () => void;
```

```svelte
<!-- src/app/components/MenuDialog.svelte -->
export let surrenderAvailable = false;
export let responsePending = false;
export let onopensettings: () => void;
export let onsurrender: () => void;
export let onclose: () => void;
```

```svelte
<!-- src/app/components/SettingsDialog.svelte -->
export let settings: UiSettingsState;
export let coreVersion: readonly [number, number] | null = null;
export let activeSnapshotId: string | null = null;
export let fallbackSnapshotId: string | null = null;
export let onshowduelhud: (value: boolean) => void;
export let onshowworkspace: (value: boolean) => void;
export let onclose: () => void;
```

## data-cy contract added here

`app-menubar`, `app-menubar-settings-button`, `menu-dialog-backdrop`, `menu-dialog`, `menu-dialog-heading`, `menu-dialog-settings-button`, `menu-dialog-surrender-button`, `menu-dialog-surrender-confirm-button`, `menu-dialog-surrender-cancel-button`, `menu-dialog-surrender-warning`, `menu-dialog-close-button`, `settings-dialog-backdrop`, `settings-dialog`, `settings-dialog-heading`, `settings-show-duel-hud-checkbox`, `settings-show-duel-hud-label`, `settings-show-workspace-checkbox`, `settings-show-workspace-label`, `settings-engine-version`, `settings-active-snapshot`, `settings-dialog-close-button`.

## TDD

1. **Red** — add `tests/unit/ui-settings-store.test.ts` and `tests/component/AppChrome.test.ts` first; both fail on missing modules.
2. **Green** — create the store and the three components, then wire them into `App.svelte`.
3. **Refactor** — extract the shared backdrop/escape/focus behaviour only if both dialogs end up byte-identical; otherwise leave duplicated.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `defaults hide both panels` | `createUiSettingsStore()` | `get(store)` equals `{ showDuelHud: false, showWorkspace: false }` |
| `setShowDuelHud flips only its own flag` | `setShowDuelHud(true)` | `{ showDuelHud: true, showWorkspace: false }` |
| `setShowWorkspace flips only its own flag` | `setShowWorkspace(true)` | `{ showDuelHud: false, showWorkspace: true }` |
| `reset returns to defaults` | both set true then `reset()` | equals `DEFAULT_UI_SETTINGS` |
| `menubar exposes one settings button` | render `AppMenubar` | `[data-cy="app-menubar-settings-button"]` present, accessible name `Settings`, click calls `onopensettings` once |
| `menu dialog offers settings and surrender` | render `MenuDialog` with `surrenderAvailable: true` | both `[data-cy="menu-dialog-settings-button"]` and `[data-cy="menu-dialog-surrender-button"]` present; surrender button has class `danger` |
| `surrender needs confirmation` | click surrender | `onsurrender` not called; `[data-cy="menu-dialog-surrender-confirm-button"]` visible; clicking it calls `onsurrender` exactly once |
| `surrender cancel returns to the menu` | click surrender then cancel | `[data-cy="menu-dialog-surrender-button"]` visible again, `onsurrender` never called |
| `surrender hidden when unavailable` | `surrenderAvailable: false` | `[data-cy="menu-dialog-surrender-button"]` absent |
| `surrender disabled while a response is pending` | `surrenderAvailable: true, responsePending: true` | confirm button is disabled |
| `escape closes the menu dialog` | `keydown Escape` on document | `onclose` called once |
| `backdrop click closes the menu dialog` | click `[data-cy="menu-dialog-backdrop"]` | `onclose` called once |
| `settings dialog reflects state` | `settings: { showDuelHud: true, showWorkspace: false }` | HUD checkbox checked, workspace checkbox unchecked |
| `settings dialog reports toggles` | click workspace checkbox | `onshowworkspace` called once with `true` |
| `settings dialog shows engine build info` | `coreVersion: [11, 0], activeSnapshotId: "abc123def456ghi"` | `[data-cy="settings-engine-version"]` text contains `ocgcore 11.0`; `[data-cy="settings-active-snapshot"]` text contains `abc123def456` |

## Impl steps

- [ ] 1. Create `tests/unit/ui-settings-store.test.ts` with the first four rows of the test plan; run `npx vitest run tests/unit/ui-settings-store.test.ts` and record the module-not-found failure.
- [ ] 2. Create `src/app/stores/ui-settings-store.ts` with exactly the signature above; every emitted state is `Object.freeze`d.
- [ ] 3. Re-run the store test to green.
- [ ] 4. Create `tests/component/AppChrome.test.ts` with `// @vitest-environment jsdom` on line 1 and the remaining eleven rows; run it and record failures.
- [ ] 5. Create `src/app/components/AppMenubar.svelte`: `<header class="app-menubar" data-cy="app-menubar">` containing `<button type="button" class="secondary" data-cy="app-menubar-settings-button" onclick={onopensettings}>Settings</button>`.
- [ ] 6. Create `src/app/components/MenuDialog.svelte`: a `div.dialog-backdrop[data-cy="menu-dialog-backdrop"]` whose `onclick` calls `onclose` only when `event.target === event.currentTarget`, wrapping `div.dialog-panel[role="dialog"][aria-modal="true"][aria-labelledby="menu-dialog-heading"][data-cy="menu-dialog"]`.
- [ ] 7. In `MenuDialog.svelte`, hold `let confirming = false`. When `confirming === false` render the settings button (`class="neutral"`), the surrender button (`class="danger"`, only when `surrenderAvailable`) and the close button. When `confirming === true` render a `role="alert"` warning plus confirm (`class="danger"`, `disabled={responsePending}`) and cancel buttons.
- [ ] 8. In `MenuDialog.svelte`, add `<svelte:window onkeydown={…} />` calling `onclose()` on `Escape` after `preventDefault()`, and `onMount` focusing the first `button` inside the panel.
- [ ] 9. Create `src/app/components/SettingsDialog.svelte` with the same backdrop/panel/escape/focus shape, containing two `<label><input type="checkbox" …></label>` pairs and two read-only `<p>` info lines. Checkbox handlers read `event.currentTarget.checked`.
- [ ] 10. In `SettingsDialog.svelte`, render engine text as `coreVersion === null ? "Engine not ready" : \`ocgcore ${coreVersion[0]}.${coreVersion[1]}\``, and snapshot text as `activeSnapshotId === null ? "No active snapshot" : \`Active assets ${activeSnapshotId.slice(0, 12)}\`` with ` · fallback ${fallbackSnapshotId.slice(0, 12)}` appended when a fallback exists.
- [ ] 11. In `src/styles/app.css`, add `button.neutral { color: #e8edf8; border-color: var(--border); background: #33405a; }` and `button.neutral:hover:not(:disabled) { background: #3f4e6c; }` directly after the existing `button.danger` rule.
- [ ] 12. In `src/styles/app.css`, add `.app-menubar { display: flex; align-items: center; justify-content: flex-end; gap: .75rem; width: min(90rem, calc(100% - 2rem)); margin-inline: auto; padding-block: .75rem; }`.
- [ ] 13. In `src/styles/app.css`, add `.dialog-backdrop { position: fixed; z-index: var(--duel-field-layer-menu); inset: 0; display: grid; place-items: center; padding: 1rem; background: rgb(4 9 18 / .72); }` and `.dialog-panel { display: grid; gap: .75rem; width: min(28rem, 100%); max-height: 85svh; overflow: auto; padding: 1.15rem; border: 1px solid var(--border); border-radius: .9rem; background: var(--surface-strong); box-shadow: 0 1rem 3rem rgb(0 0 0 / .45); }`.
- [ ] 14. In `src/app/App.svelte`, import the three components and `createUiSettingsStore`; add `const uiSettings = createUiSettingsStore();` beside `const duel = createDuelStore(client);`.
- [ ] 15. In `src/app/App.svelte`, add `let menuOpen = false; let settingsOpen = false; let menubarTrigger: HTMLButtonElement | null = null;` and helpers `openMenu()`, `closeMenu()`, `openSettings()`, `closeSettings()` that restore focus with `await tick()` then `menubarTrigger?.focus()`.
- [ ] 16. In `src/app/App.svelte`, render `<AppMenubar onopensettings={openMenu} />` immediately before the existing `<header class="app-header">`, and render `{#if menuOpen}<MenuDialog … />{/if}` and `{#if settingsOpen}<SettingsDialog … />{/if}` at the end of `<main>`.
- [ ] 17. Wire `MenuDialog` props: `surrenderAvailable={($duel.status === "active" || $duel.status === "awaiting-input") && !$duel.result}`, `responsePending={$duel.responsePending}`, `onopensettings={() => { menuOpen = false; settingsOpen = true; }}`, `onsurrender={() => { duel.surrender(); menuOpen = false; }}`, `onclose={closeMenu}`.
- [ ] 18. Wire `SettingsDialog` props from `$uiSettings`, `$duel.coreVersion`, `snapshotStorageStatus.activeSnapshotId`, `snapshotStorageStatus.fallbackSnapshotId`, and the two store setters.
- [ ] 19. Run `npx vitest run tests/component/AppChrome.test.ts` to green.
- [ ] 20. Run `npx vitest run tests/unit/data-cy-coverage.test.ts`; add any missing `data-cy` on the new elements until green.

## Outputs

- Files created: `src/app/stores/ui-settings-store.ts`, `src/app/components/AppMenubar.svelte`, `src/app/components/MenuDialog.svelte`, `src/app/components/SettingsDialog.svelte`, `tests/unit/ui-settings-store.test.ts`, `tests/component/AppChrome.test.ts`.
- Files edited: `src/app/App.svelte`, `src/styles/app.css`.
- Public API: `UiSettingsStore` is consumed by T5.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/ui-settings-store.test.ts` passes
- [ ] `npx vitest run tests/component/AppChrome.test.ts` passes
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] manual check: `npm run dev`, click `Settings` in the menubar, confirm the menu shows a grey Settings button and a red Surrender button, confirm the settings dialog shows both checkboxes and the `ocgcore 11.0` line, confirm `Escape` closes each dialog and focus returns to the menubar button
- [ ] app functional — old surrender panel still works, duel unaffected
- [ ] commit msg draft: `feat(app): add menubar with menu and settings dialogs`
