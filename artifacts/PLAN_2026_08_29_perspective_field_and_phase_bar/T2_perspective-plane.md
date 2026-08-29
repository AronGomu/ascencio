# T2: Perspective plane render

**Plan:** `./artifacts/PLAN_2026_08_29_perspective_field_and_phase_bar.md`
**Depends:** T1
**Commit outcome:** the duel board renders on one `perspective(600px) rotateX(20deg)` plane whose flat canvas uses the virtual height, filling the board box top to bottom; drag, hover-zoom, keyboard focus and floating windows still work.

## Context (self-contained)

- Goal: Tag Force-style perspective — camera behind the player, opponent rows smaller.
- This slice: the transform and the two-size layout (board box vs. virtual canvas). Card-level presentation (upright hands, fan, shadows) is T3.
- Out of scope here: hand/fan/shadow styling, phase bar, settings.
- Assumptions in force: A4 (quarter-turn stage composes; verified here, not assumed).

## Requirements

- One wrapper element inside `.duel-field-board` carries the entire projection; zones/cards/hand bands keep their existing absolute-position CSS untouched.
- Flat canvas height = `perspectiveVirtualHeight(boardHeight, 20, 600)`; canvas is bottom-anchored (`transform-origin: 50% 100%`), so growth fills upward and the player's hand row never moves.
- Content origin inside the plane (reviewer finding 1; prototype `:746-750`): geometry fits `min(height-bound, width-bound)`, so the laid-out field can be smaller than the plane canvas on either axis. Placements are offset by `origin = { x: (boardWidth − geometry.width) / 2, y: planeHeight − geometry.height }` — horizontally centred, bottom-anchored — before they become `--field-x/y`. Without the `y` offset a width-bound fit hugs the plane top and the hand row rises. Implement in `measuredRenderLayout` (offset the layout once) or as a positioned inner wrapper; either way the offset is part of this ticket.
- Board box (`.duel-field` section size, scroll-region, floating-window clamp boundary) stays at the measured slot size — projected content lands inside it.
- Overlays that must NOT inherit the transform (they already mount as siblings of `.duel-field-scroll-region` inside `.duel-field`: `DragGhost`, `HandZoomOverlay`, `DropConfirmDialog`, `ZoneListDialog`, `FloatingFieldWindow`, `FieldLines` — see `src/battle/app/components/DuelField.svelte:1385-1537`): verify none moves into the plane.
- `PhaseStrip` and the hand-activation drop zone currently render inside `.duel-field-stage` (`DuelField.svelte:1360-1380`). Hand-activation zone moves INTO the plane (it targets a flat-space placement). PhaseStrip stays where it is untouched (T4 deletes it); its `--phase-y: bandY` now lands in virtual-canvas space, so anchor the strip inside the plane too — one-line move, removed again by T4.
- No behavior change to `elementFromPoint` paths — native hit-testing resolves through transforms (`src/battle/app/presentation/stage-frame.ts:4-6` documents this for the quarter turn; same property covers the plane).

## Inputs

- **From T1:** `perspectiveVirtualHeight(boardHeight, tiltDeg, cameraPx): number` and compacted `createFieldRenderLayout(emz, w, h)` from `src/battle/field/duel-field-geometry.ts`. `FieldGeometry.height` is the flat canvas height for the layout you feed it.
- `src/battle/app/components/DuelField.svelte` — `measuredRenderLayout` (`:315`), `observeLayoutBoundary` (`:341`), section `style` (`:1313`).
- `src/battle/app/components/duel-field/FieldBoard.svelte` — board root, where the plane wrapper goes.
- `src/styles/app.css` — `.duel-field-board` block (`:1286`).
- `src/battle/app/presentation/stage-frame.ts` — read-only; the rotated-phone mapping must keep passing its tests.
- `e2e/duel-smoke.spec.ts` — existing duel drag flow and perspective fill assertions (supervisor-supplied Input).

## Interface contract (level 5)

- **Produces:**

```ts
// src/battle/field/perspective.ts (new)
export const FIELD_TILT_DEG = 20;
export const FIELD_CAMERA_PX = 600;
/** CSS transform for the plane, "" when tilt is 0 (test/flat mode). */
export function fieldPlaneTransform(tiltDeg?: number, cameraPx?: number): string;
// returns `perspective(600px) rotateX(20deg)` with defaults
```

```svelte
<!-- FieldBoard.svelte: new prop + wrapper -->
export let planeHeight: number;      // virtual canvas height in px
export let planeTransform: string;   // "" disables (jsdom/component tests unaffected)
<div class="duel-field-board" ...>            <!-- board box, overflow hidden, UNCHANGED size -->
  <div class="duel-field-board__surface" .../>
  <div
    class="duel-field-board__plane"
    data-cy="duel-field-board-plane"
    style={`height: ${planeHeight}px; transform: ${planeTransform};`}
  >
    <!-- every zone/hand/stack/card render moves inside, unchanged -->
  </div>
</div>
```

```css
/* app.css */
.duel-field-board__plane {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  transform-origin: 50% 100%;
  transform-style: preserve-3d;
}
```

```ts
// DuelField.svelte measuredRenderLayout becomes:
const boardHeight = height > 0 ? height : 720;
const planeHeight = perspectiveVirtualHeight(boardHeight, FIELD_TILT_DEG, FIELD_CAMERA_PX);
renderLayout = createFieldRenderLayout(profile, width > 0 ? width : 1280, planeHeight);
// section style stays boardWidth x boardHeight (NOT geometry.height);
// planeHeight passed to FieldBoard; hand-activation zone + PhaseStrip move inside the plane
```

- **Consumes:** T1's `perspectiveVirtualHeight` exactly as exported; `FieldRenderLayout` map (placements now in virtual-canvas coordinates).
- **Errors:** none new. `planeTransform=""` + `planeHeight === boardHeight` must reproduce today's flat render byte-identical in the DOM (minus the wrapper div).
- **Invariants:**
  - `.duel-field` section, `.duel-field-scroll-region`, floating-window clamp boundary all keep board-box dimensions.
  - No `position: fixed` element is a descendant of `.duel-field-board__plane` (a transformed ancestor would become its containing block).
  - Component tests (jsdom, no compositor) pass with the transform present — nothing reads projected pixel positions.
- **Integration links:** trigger `DuelField.svelte` ResizeObserver → dispatch new layout + planeHeight into `FieldBoard` props → observe `[data-cy="duel-field-board-plane"]` style in Chromium: `getBoundingClientRect().height` of the plane ≈ board height (±8px) and plane style height > board height.

## TDD

1. **Red** — component test: `FieldBoard` renders `[data-cy="duel-field-board-plane"]` with given height/transform and all zones inside it; DuelField test: section height stays board-box height while placements exceed it.
2. **Green** — wrapper + wiring.
3. **Refactor** — none expected.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| plane present | render `FieldBoard` with `planeHeight: 1422`, `planeTransform: "perspective(600px) rotateX(20deg)"` | plane element exists, inline style carries both; every `data-cy^="field-zone"` is its descendant |
| flat mode identical | `planeTransform: ""`, `planeHeight === boardHeight` | zone placements equal pre-change values (reuse an existing DuelField.test snapshot-ish assertion) |
| section vs canvas | DuelField with 900×735 boundary | section style height `735px`; placements stay within `[0, planeHeight]`; `renderLayout.geometry.height > 735` |
| width-bound anchor | narrow-tall boundary (e.g. 600×900) where width binds | `p0:hand` placement bottom edge ≡ `planeHeight − margin` region (bottom-anchored), not hugging plane top |
| fixed-position audit | DuelField full render | no element with `position: fixed` computed inside the plane (walk `[data-cy="duel-field-board-plane"]` subtree) |
| transform fn | `fieldPlaneTransform()` / `fieldPlaneTransform(0, 600)` | `"perspective(600px) rotateX(20deg)"` / `""` |
| e2e drag survives | Playwright: start duel, drag a hand card onto a monster zone | drop candidate highlights under pointer; card placed (existing e2e flow re-run, now over the transform) |
| e2e fill | Playwright: measure plane vs board rects | `boardRect.top − planeRect.top ≤ 8` |

## Impl steps

- [x] 1. `src/battle/field/perspective.ts` + unit test — verify: `npx vitest run tests/unit/perspective.test.ts` (new file).
- [x] 2. Red component tests (FieldBoard plane, DuelField sizing) — verify: `npx vitest run tests/component/DuelField.test.ts tests/component/FieldBoard.test.ts` fails on missing plane behavior.
- [x] 3. FieldBoard wrapper + props; move zone/hand/stack/card markup inside; CSS block — verify: `npx vitest run tests/component/FieldBoard.test.ts` passes.
- [x] 4. DuelField: planeHeight computation, section sizing, hand-activation zone + PhaseStrip into the plane — verify: `npx vitest run tests/component/DuelField.test.ts` passes.
- [x] 5. Green: `npx vitest run tests/component/DuelField.test.ts tests/component/FieldBoard.test.ts` (create FieldBoard test file if absent).
- [x] 6. e2e: extend `e2e/duel-smoke.spec.ts` with fill + drag assertions — verify: `npx playwright test e2e/duel-smoke.spec.ts` passes.

## Validation

- [x] `npm run check:headless`
- [x] `npx playwright test` (duel specs)
- [ ] manual: `npm run dev` — field tilted, top filled, drag + hover-zoom + keyboard arrows + floating window drag all work; portrait-phone emulation (rotated stage) still drags correctly
- [x] no silent-failure swallow added — `none` expected
- [x] app functional — flat fallback (`fieldPlaneTransform(0, …)`) renders identically to pre-change
- [ ] commit msg draft: `feat(duel): render the field on a perspective plane filled by virtual height`
