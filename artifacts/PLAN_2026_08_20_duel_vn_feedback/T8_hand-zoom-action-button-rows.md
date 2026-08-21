# T8: Zoom action button rows

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T4
**Commit outcome:** A hovered hand card with legal actions shows those actions stacked one per row above the zoomed card, each button spanning the zoom's full width.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 3.
- This slice: layout only — the chips that already appear above a zoomed hand card become a full-width vertical button list with text scaled to the enlarged frame.
- Out of scope here: click-to-pin (T9), the drop confirmation modal (T11), which actions exist (the engine decides).
- Assumptions in force: the zoom scale stays 1.6× (ADR-032); one button per row; text scales with the zoom width; the pointer bridge between the card and the buttons keeps working so the pointer can travel to a button without dismissing the overlay.

## Requirements

- Each `InteractionChoice` renders as its own row inside the overlay's bridge, at `width: 100%` of the zoomed card box.
- Button font size scales from the zoom width rather than staying at the chip size, with a floor that keeps the 44px interaction height.
- Hovering from the card up onto a button never dismisses the overlay (the existing `onzoomleave` union check must still hold).

## Inputs

- `src/battle/app/components/duel-field/HandZoomOverlay.svelte`
  - computes `w = anchor.width * scale`, `h = anchor.height * scale`, `scale = 1.6`, and sets `overlayStyle` with `--hand-zoom-bridge-bottom`.
  - renders `.hand-zoom-overlay__bridge` containing `<CardActionChips … dataCyScope="hand-zoom-overlay" />` when `choices.length > 0`.
  - after T4 it also owns `imageLibrary`, `cardBackUrl`, `placeholderUrl` and its own lease.
- `src/battle/app/components/duel-field/CardActionChips.svelte` — the chip row component; `data-cy` values are scoped by `dataCyScope`.
- `src/styles/app.css` — search `hand-zoom-overlay` for the overlay, bridge and chip rules.
- `tests/component/HandZoomOverlay.test.ts`, `tests/component/CardActionChips.test.ts`.
- ADR-032 (`docs/ADR/032_ADR_hand_zoom_overlay_layer.md`) — §4 (keyboard flow never opens the overlay) and §5 (the leave union) must keep holding.

## From Depends

- T4 changed `HandZoomOverlay.svelte` to take `imageLibrary: Pick<CardImageLibrary,"lease"> | null`, `cardBackUrl: string`, `placeholderUrl: string` instead of `imageUrl`, added a lease lifecycle released on card change and destroy, and removed the `imageUrls` prop from `DuelField`, `FieldBoard` and `HandBand`. `DuelField.svelte` now mounts the overlay as `<HandZoomOverlay card={handZoom.card} anchor={handZoom.anchor} frameWidth={handZoom.frameWidth} {imageLibrary} cardBackUrl={resolvedCardBackUrl} placeholderUrl={resolvedPlaceholderUrl} choices={…} … />`.

## TDD

1. **Red** — add `stacks one action per row at the zoom width` to `tests/component/HandZoomOverlay.test.ts`: render with three choices and assert three elements matching `[data-cy^="hand-zoom-overlay-action-"]`, each a direct child of the action list.
2. **Green** — add a `--hand-zoom-width` custom property to the overlay style and a `.hand-zoom-overlay__actions` grid rule; give `CardActionChips` a `layout: "row" | "stack"` prop defaulting to `"row"` and pass `"stack"` from the overlay.
3. **Refactor** — keep the chip component's existing row layout for its other caller (the pinned field menu) untouched.

## Test plan

| Test                                                | Input                                                | Expect                                                           |
| --------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| `stacks one action per row at the zoom width`       | 3 choices                                            | 3 action buttons, container rule is `grid-template-columns: 1fr` |
| `keeps the pointer bridge between card and actions` | pointerleave with `relatedTarget` inside the overlay | `onzoomleave` receives the related target; overlay not dismissed |
| `renders no action list when there are no choices`  | `choices: []`                                        | no `[data-cy^="hand-zoom-overlay-action-"]` element              |
| `chips keep their row layout for the field menu`    | `CardActionChips` default props                      | container rule stays the existing inline row                     |

## Impl steps

- [ ] 1. Add the failing tests above; run `npx vitest run tests/component/HandZoomOverlay.test.ts`.
- [ ] 2. In `HandZoomOverlay.svelte`, append `--hand-zoom-width: ${w}px;` to `overlayStyle`.
- [ ] 3. In `CardActionChips.svelte`, add `export let layout: "row" | "stack" = "row";` and set `class:is-stacked={layout === "stack"}` on its container; keep every existing `data-cy` value.
- [ ] 4. Pass `layout="stack"` from `HandZoomOverlay.svelte`.
- [ ] 5. In `src/styles/app.css`, add a rule for the stacked variant: `display: grid; grid-template-columns: 1fr; gap: var(--space-1); width: var(--hand-zoom-width);` and a button rule with `min-height: 44px; font-size: max(0.72rem, calc(var(--hand-zoom-width) / 11));`.
- [ ] 6. Confirm `.hand-zoom-overlay__bridge` still spans from the action list down to the card's top edge using `--hand-zoom-bridge-bottom`; adjust its height rule if the taller stack changes the geometry.
- [ ] 7. Re-run the component tests and `npx vitest run tests/component/CardActionChips.test.ts`.
- [ ] 8. Manually hover a hand card with two or more actions and move the pointer up onto a button without the overlay closing.

## Outputs

- Files touched: `src/battle/app/components/duel-field/HandZoomOverlay.svelte`, `src/battle/app/components/duel-field/CardActionChips.svelte`, `src/styles/app.css`, `tests/component/HandZoomOverlay.test.ts`, `tests/component/CardActionChips.test.ts`.
- Behaviour change: actions above a zoomed hand card are full-width rows.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/HandZoomOverlay.test.ts tests/component/CardActionChips.test.ts` passes
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: hover a hand card with several actions — one button per row, full zoom width, readable text
- [ ] app functional — the field's own pinned chip menu is unchanged
- [ ] commit msg draft: `feat(hand-zoom): stack card actions one per row at the zoom's own width`
