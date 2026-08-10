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
- **From Depends (T9):** non-scrolling viewport shell, responsive field/preview tracks, zone-list image cap.
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

- [ ] 1. Add `persisted-ui-store.test.ts` red; create store over T3 read/write functions; migrate App's deck selection to store without behaviour change; run green.
- [ ] 2. Add clamp tests/module.
- [ ] 3. Add primitive component tests/component; use document pointerdown/keydown listeners installed on mount and removed on destroy; handle pointer capture; ResizeObserver both boundary/window.
- [ ] 4. Add ephemeral `activeWindowId` in DuelField; pass active/onactivate.
- [ ] 5. Refactor ZoneListDialog to render inside primitive (or accept wrapper props from DuelField, choose one owner only). Header is handle, red X is excluded interactive child, list content unchanged. Avoid duplicate document outside/Escape listeners.
- [ ] 6. Add wheel-to-horizontal handler to entries; consume only when `scrollWidth>clientWidth` and movement is possible.
- [ ] 7. Wrap FieldActionBar in confirm primitive. Make bar normal-flow; remove absolute bottom/transform/max positioning from it.
- [ ] 8. Delete action-bar height CSS var/padding measurement if no longer used. Keep confirmation validation/content logic untouched.
- [ ] 9. Change DuelField generic outside-click: when confirm visible, never dispatch cancel/pass from outside. Keep interactions inside all windows in `INTERACTIVE_SELECTOR`.
- [ ] 10. If `.duel-field` scrolls after T9, move stage into `.duel-field-scroll-region { overflow:auto; min-width:0; min-height:0 }`, root `overflow:hidden`; keep window roots/feedback outside scroll child. Update T9 e2e selector to pan child.
- [ ] 11. Thread four props/callbacks through ErrorBoundary and App; App reads/writes this ticket's persisted store.
- [ ] 12. Run integration/e2e; verify positions field-local across page reload and worker rematch.
- [ ] 13. Create ADR-017 with dismissal matrix and coordinate contract; reference ADR-007/009/010.

## Outputs

- Files created: `src/app/stores/persisted-ui-store.ts`, `tests/unit/persisted-ui-store.test.ts`, `src/app/presentation/floating-window-position.ts`, `src/app/components/duel-field/FloatingFieldWindow.svelte`, `tests/unit/floating-window-position.test.ts`, `tests/component/FloatingFieldWindow.test.ts`.
- Files edited: `App.svelte`, `DuelField.svelte`, `DuelFieldErrorBoundary.svelte`, `ZoneListDialog.svelte`, `FieldActionBar.svelte`, `app.css`, focused tests/e2e.
- Public component API: window props/callbacks.
- Persistence: existing `ygo.ui.v1` fields become live; no schema change.

## Validation

- [ ] `npm run test:unit -- floating-window-position persisted-ui-store` passes
- [ ] `npm run test:component -- FloatingFieldWindow ZoneListDialog DuelField` passes
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [ ] `npm run build` succeeds
- [ ] full chromium e2e passes with pinned command from T5
- [ ] manual drag/reload/resize for both windows; no out-of-bounds rect
- [ ] outside/Escape dismissal matrix exact; no live decision lost
- [ ] app functional — narrow board pan never moves windows offscreen
- [ ] commit msg draft: `feat(field): persist constrained floating windows`
