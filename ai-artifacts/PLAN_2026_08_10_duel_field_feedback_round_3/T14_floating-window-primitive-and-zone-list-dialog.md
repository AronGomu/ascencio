# T14: Floating window primitive and zone list dialog

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T3, T9
**Commit outcome:** Zone list and selection-confirm surfaces are independent draggable windows constrained to the visible duel field and remember their positions. Zone list closes on outside click/Escape/red X and wheel-scrolls; confirm never closes/cancels from outside click or Escape.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers items 4 and 30; provides window shell for T16.
- Current `ZoneListDialog` is centred absolute UI with a text `Close` button. Current `FieldActionBar` is an absolute bottom bar and generic field outside-click may cancel its live prompt.
- Out of scope: consolidated target content/badges (T16), changing selection reducer, modal app dialogs, arbitrary resizable windows.
- Assumptions **A14/A15**: both windows draggable and field-contained; list outside-click closes, confirm does not; independent positions under `ygo.ui.v1`; positions are field-local CSS px.
- **From T9:** default page is fixed and field can own internal panning. Window layer must be relative to the visible `.duel-field` viewport, not its 52rem scrolling board content.

## Requirements

- Shared `FloatingFieldWindow` owns placement, handle drag, clamp, active z-order hook, outside/Escape dismissal policy and ResizeObserver reclamp.
- Drag starts on header/handle only; pressing close/other interactive child never starts drag. Pointer capture keeps drag alive outside handle.
- Position is `{x,y}` top-left CSS pixels inside visible field content box. Entire measured window border box clamps inside boundary. Oversized axis pins to 0.
- `null` persisted position centres after first measurement and remains responsive-centred until user drags; no storage write solely for default centre.
- On pointerup, emit one final clamped position; this ticket's persisted UI store writes through. Re-clamp a non-null position on field/window resize and persist changed clamp only.
- Two windows may coexist and move independently. Last pointerdown/drag raises one; z-order is ephemeral and not persisted.
- Zone list: `aria-modal=false`; red `×` button at header right, accessible `Close <zone>`; closes on X, Escape, pointerdown outside; wheel over horizontal entries converts vertical `deltaY` to horizontal scroll and prevents page/field scroll only while it can consume movement.
- Confirm: wraps current `FieldActionBar`; never dismisses/cancels/passes on outside click or Escape. Closes only on accepted submit, prompt replacement/result, or explicit engine-valid Cancel.
- Clicking confirm counts as outside the zone list and may close list; confirm stays.
- Generic `DuelField.dismissOnOutsideClick` returns without dispatching cancel/pass whenever confirm window is visible and origin is outside it.
- Every button remains ≥44 px. T9 image cap stays.
- If T9 uses `.duel-field` as the scroll container, introduce a child `.duel-field-scroll-region` for board/stage and make root the non-scrolling window boundary. Do not let a horizontal board pan carry windows offscreen.

## Inputs

- **From Depends (T3):** `PersistedUiState`, `PersistedWindowPosition`, `readPersistedUiState`, `writePersistedUiState`, exact `ygo.ui.v1` schema; App currently persists deck selection through these pure functions.
- **From Depends (T9), as actually shipped in `eb431e9`:** `#app` is `height:100svh`; `<main>` gains `.is-duel-viewport` with `overflow:hidden` in default duel mode; `.duel-row` stacks below **79rem** (not 80rem — measured, 80rem broke the field at 1280×720); on short viewports the preview collapses to thumbnail + name + scrolling text; `.zone-list-entry > img` is capped `max-height:50svh; object-fit:contain`. **`.duel-field` is now itself `overflow:auto` in constrained mode, so Impl step 10 applies — the window boundary must be a non-scrolling root, not the scroll container.** Also from T9: `.field-action-bar` was moved onto `.duel-field-stage` because `.duel-field`'s box can be clipped shorter than the board; when you make the bar normal-flow inside the confirm window (Impl steps 7–8), remove that stage-level positioning and its `assertFieldActionBarGeometry` e2e expectations coherently rather than leaving two owners.
- **Later tickets already on the branch that touch the same surfaces:**
  - T10 `c8e007b` — `EndTurnButton` now lives inside `PhaseStrip`'s right group, anchored `right:1%`; the narrow-viewport 4rem action-bar gutter was already deleted; `DuelHeaderBar` wraps role + life in `.duel-header-bar__meta`.
  - T11 `033af59` — `PhaseStrip` takes `extraMonsterZones`; link-free duels (all six bundled decks) render 32 zones, no `shared:extraMonster:*`, and a continuous right-anchored strip. `mapSnapshotToBoard` takes an optional `prompt` argument and can fail with `layout_profile_conflict`, in which case App forces a blocking alert and nulls `effectivePrompt`.
  - T12 `69ef913` — green = legal, orange = selected/list-hover, teal = feedback, neutral focus; hover zoom `1.35`/`120ms` scoped `:not(.is-pinned)`; hovered/pinned card parents raised; `ZoneListEntryTile` already has a `selected` prop awaiting T16.
  - T13 `e69564e` — a `position:fixed` drag ghost mounts at `.duel-field` level (sibling of `.duel-field-stage`) to escape the board's `isolation:isolate`, on layer var `--duel-field-layer-drag-ghost: 150`, above `--duel-field-layer-menu: 100`. Your window layer must coexist: the ghost is meant to float above field windows, and it is `pointer-events:none` so it never steals outside-click detection. If you introduce `.duel-field-scroll-region`, keep the ghost mount point outside it.
  - T8 `3f0e437` — hands are `HandBand.svelte` scroll viewports; the band root uses `data-feedback-zone-id`. `INTERACTIVE_SELECTOR` work must not accidentally swallow hand-band arrows.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here (`playwright.config.ts` includes an unsupported `webkit-smoke` project). Use `npm run check:headless` plus the explicit Chromium invocation.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.
- The app opens on a deck picker (T3); e2e must go through it as the existing specs do.
- `src/app/components/DuelField.svelte:91` — `fieldRoot`; `:316-354` — interactive selector/outside cancel; `:441-455` root; `:484-502` list; `:520-530` action bar.
- `src/app/components/duel-field/ZoneListDialog.svelte:41-49` — Escape; `:51-81` centred content/header/Close/entries.
- `src/app/components/duel-field/FieldActionBar.svelte` — decision content and bound `clientHeight`; remove positioning responsibility, not logic.
- `src/app/components/duel-field/DuelFieldErrorBoundary.svelte` — forwards DuelField props explicitly; add window props/callbacks.
- `src/styles/app.css:1062-1089` — list positioning; `:1287-1325` — action-bar positioning and measured padding; T9 may modify field overflow.
- `tests/component/ZoneListDialog.test.ts`, `tests/component/DuelField.test.ts`, `tests/unit/persisted-ui-store.test.ts`, e2e responsive/zone-list cases.
- ADR-007 owns stack addresses; ADR-009 owns selection; ADR-010 owns phase placement. ADR-017 owns mechanics only.

## API design

New `src/app/stores/persisted-ui-store.ts`:

```ts
export interface PersistedUiStore extends Readable<PersistedUiState> {
  setDecks(player: DeckId, opponent: DeckId): void;
  setWindowPosition(
    window: "zoneList" | "confirm",
    position: PersistedWindowPosition | null,
  ): void;
}
export function createPersistedUiStore(
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): PersistedUiStore;
```

Store initializes through T3 `readPersistedUiState`; every setter immutably replaces one field and writes complete v1 state through `writePersistedUiState`.

New `src/app/presentation/floating-window-position.ts`:

```ts
export type FieldWindowId = "zoneList" | "confirm";

export interface Size { readonly width: number; readonly height: number }

export function clampFieldWindowPosition(
  position: PersistedWindowPosition,
  boundary: Size,
  windowSize: Size,
): PersistedWindowPosition;
```

Clamp x to `0…max(0,boundary.width-window.width)`, y likewise; nonfinite inputs normalize to 0; return frozen object.

New `src/app/components/duel-field/FloatingFieldWindow.svelte`:

```ts
export let windowId: FieldWindowId;
export let ariaLabel: string;
export let boundaryElement: HTMLElement | null = null;
export let position: PersistedWindowPosition | null = null;
export let dismissOnOutsideClick = false;
export let dismissOnEscape = false;
export let active = false;
export let disabled = false;
export let onactivate: (id: FieldWindowId) => void = () => undefined;
export let onpositionchange: (position: PersistedWindowPosition) => void = () => undefined;
export let ondismiss: () => void = () => undefined;
```

Use Svelte snippets/slots consistent with project version: one handle/header slot and one content slot. Root/handle/content `data-cy` = `floating-field-window-${windowId}`, `...-${windowId}-handle`, `...-${windowId}-content`. Root `role=dialog`, `aria-modal=false`, inline `--window-x/--window-y`, classes active/dragging.

DuelField new props:

```ts
export let zoneListWindowPosition: PersistedWindowPosition | null = null;
export let confirmWindowPosition: PersistedWindowPosition | null = null;
export let onzoneListWindowPositionChange: (p: PersistedWindowPosition) => void;
export let onconfirmWindowPositionChange: (p: PersistedWindowPosition) => void;
```

## TDD

1. **Red** — persisted store, pure clamp, then primitive behaviour before integration.
2. **Green** — primitive, list wrapper, confirm wrapper, persistence threading.
3. **Refactor** — move scroll child only if browser proves root scrolling carries overlay.

## Test plan

New `tests/unit/floating-window-position.test.ts`:

- in-bounds unchanged; negative→0; right/bottom→boundary-window; oversized→0; nonfinite→0; result frozen.

New `tests/component/FloatingFieldWindow.test.ts` with stub rects/ResizeObserver:

- null centres without emitting;
- handle pointer drag uses capture and updates transform; content drag does not;
- interactive handle child does not start drag;
- pointerup emits exactly one clamped point;
- boundary/window resize reclamps non-null point and emits only changed clamp;
- outside pointerdown dismisses only when prop true; inside never;
- Escape dismisses only when prop true;
- active/dragging classes and `data-cy` unique.

Extend `ZoneListDialog.test.ts`:

- X text, danger class, rightmost header location, accessible close name;
- outside pointerdown + Escape each close once; inside no close;
- wheel `deltaY` updates `scrollLeft`; at horizontal edge an unconsumed wheel is not prevented;
- header is primitive handle; image/list content still preview/choose.

Extend `DuelField.test.ts`:

- list and confirm render together with two positions;
- drag/list callback does not call confirm callback and vice versa;
- outside list+confirm closes list only and emits no `cancel`/chain `pass`;
- Escape closes list only;
- explicit Cancel/Confirm behaviour still reducer-owned;
- prompt key change closes both content surfaces/reset active state.

New `tests/unit/persisted-ui-store.test.ts`: initial value comes from T3 reader; `setDecks` preserves windows; independent `setWindowPosition` preserves deck pair/other window; each setter writes complete state once; throwing storage never escapes.

E2E:

- drag each window to four edges; rect contained within duel-field rect ±1;
- move both to different locations, reload/restart prompt harness, positions restored;
- resize narrower, both reclamp;
- outside click closes list, confirm remains and no response is posted;
- wheel moves entries horizontally;
- pan inner board horizontally; windows remain fixed to visible field viewport.

## Impl steps

- [x] 1. Add `persisted-ui-store.test.ts` red; create store over T3 read/write functions; migrate App's deck selection to store without behaviour change; run green. — criterion: `npx vitest run tests/unit/persisted-ui-store.test.ts` green (8/8) and `AppChrome`/`DeckPicker` component tests still green (28/28) after App uses `createPersistedUiStore`.
- [x] 2. Add clamp tests/module. — criterion: `npx vitest run tests/unit/floating-window-position.test.ts` green (7/7).
- [x] 3. Add primitive component tests/component; use document pointerdown/keydown listeners installed on mount and removed on destroy; handle pointer capture; ResizeObserver both boundary/window. — criterion: `npx vitest run tests/component/FloatingFieldWindow.test.ts` green (14/14), covering capture, destroy-time listener removal and both observed boxes.
- [x] 4. Add ephemeral `activeWindowId` in DuelField; pass active/onactivate. — criterion: DuelField test `each window reports only its own position` asserts `is-active` follows the last pressed window and is never persisted.
- [x] 5. Refactor ZoneListDialog to render inside primitive (or accept wrapper props from DuelField, choose one owner only). Header is handle, red X is excluded interactive child, list content unchanged. Avoid duplicate document outside/Escape listeners. — criterion: ZoneListDialog owns the primitive, its own `svelte:document` Escape listener is gone, and `tests/component/ZoneListDialog.test.ts` green (17/17) including red-X placement/name and outside-press cases.
- [x] 6. Add wheel-to-horizontal handler to entries; consume only when `scrollWidth>clientWidth` and movement is possible. — criterion: ZoneListDialog tests `a vertical wheel over the entries scrolls them horizontally` and `a wheel over a list that cannot scroll is never consumed` green.
- [x] 7. Wrap FieldActionBar in confirm primitive. Make bar normal-flow; remove absolute bottom/transform/max positioning from it. — criterion: `.field-action-bar` CSS has no `position/bottom/left/transform`; DuelField test `renders the action bar inside the confirm window, outside the board scroll region` green.
- [x] 8. Delete action-bar height CSS var/padding measurement if no longer used. Keep confirmation validation/content logic untouched. — criterion: `--field-action-bar-height`, `data-field-action-bar`, the stage gutter margin and FieldActionBar's `clientHeight`/ResizeObserver are gone (`grep` clean); FieldActionBar component tests unchanged and green.
- [x] 9. Change DuelField generic outside-click: when confirm visible, never dispatch cancel/pass from outside. Keep interactions inside all windows in `INTERACTIVE_SELECTOR`. — criterion: DuelField tests `outside click never passes a chain while the confirm window is up`, `Escape never answers the live decision in the confirm window` and `an outside press closes the list only and answers nothing` green; `INTERACTIVE_SELECTOR` covers `.floating-field-window`.
- [x] 10. If `.duel-field` scrolls after T9, move stage into `.duel-field-scroll-region { overflow:auto; min-width:0; min-height:0 }`, root `overflow:hidden`; keep window roots/feedback outside scroll child. Update T9 e2e selector to pan child. — criterion: `tests/unit/global-styles.test.ts` proves root `overflow: hidden` + child `overflow: auto`, and the chromium e2e viewport/pan specs pass against the scroll child.
- [x] 11. Thread four props/callbacks through ErrorBoundary and App; App reads/writes this ticket's persisted store. — criterion: `npm run typecheck` clean with the four props forwarded in `DuelFieldErrorBoundary.svelte` and App wiring `$persistedUi.windows.*` to `persistedUi.setWindowPosition`.
- [x] 12. Run integration/e2e; verify positions field-local across page reload and worker rematch. — criterion: full chromium e2e green including a new window spec that drags both windows to the edges, reloads and re-measures.
- [x] 13. Create ADR-017 with dismissal matrix and coordinate contract; reference ADR-007/009/010. — criterion: `docs/ADR/017_ADR_floating_field_windows_and_dismissal.md` states the shipped dismissal matrix, coordinate contract and the scroll-region outcome.

## Outputs

- Files created: `src/app/stores/persisted-ui-store.ts`, `tests/unit/persisted-ui-store.test.ts`, `src/app/presentation/floating-window-position.ts`, `src/app/components/duel-field/FloatingFieldWindow.svelte`, `tests/unit/floating-window-position.test.ts`, `tests/component/FloatingFieldWindow.test.ts`.
- Files edited: `App.svelte`, `DuelField.svelte`, `DuelFieldErrorBoundary.svelte`, `ZoneListDialog.svelte`, `FieldActionBar.svelte`, `app.css`, focused tests/e2e.
- Public component API: window props/callbacks.
- Persistence: existing `ygo.ui.v1` fields become live; no schema change.

## Validation

- [x] `npx vitest run tests/unit/floating-window-position.test.ts tests/unit/persisted-ui-store.test.ts` passes (15 tests; the `--` filter form is not wired in this repo's script)
- [x] `npm run test:component` passes (17 files / 267 tests, including FloatingFieldWindow, ZoneListDialog and DuelField)
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass (inside `npm run check:headless`, exit 0, svelte-check 0 errors/0 warnings)
- [x] `npm run build` succeeds (`build:verify` status ok, snapshot `a562f5ad…`)
- [x] full chromium e2e passes with pinned command from T5 (`PLAYWRIGHT_BROWSERS_PATH=… npx playwright test --project=chromium` → 27 passed in 2.8m)
- [x] manual drag/reload/resize for both windows; no out-of-bounds rect — measured by the e2e spec `floating field windows stay inside the field, persist and never lose a decision` (four-corner drags, reload restore, 900×600 reclamp, all rects contained ±1)
- [x] outside/Escape dismissal matrix exact; no live decision lost — e2e asserts the respond-command count is unchanged across outside press + Escape, plus DuelField component tests for chain pass/cancel suppression
- [x] app functional — narrow board pan never moves windows offscreen (e2e scrolls `.duel-field-scroll-region` to both extremes; confirm window rect moves ≤1px)
- [x] commit msg draft: `feat(field): persist constrained floating windows`
