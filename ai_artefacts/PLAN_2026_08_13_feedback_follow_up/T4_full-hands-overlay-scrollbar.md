# T4: Full hands + overlay scrollbar

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T3
**Commit outcome:** Both hands mount all cards in one semantic horizontal scroller with pinned count + reusable custom overlay thumb; pagination is gone.

## Context (self-contained)

- Goal: Hand card height must remain geometry-derived regardless of card count. 20 cards scroll; 6 cards fit; native bar must not consume band height.
- This slice: Create shared axis-aware overlay scrollbar, migrate HandBand, remove paging only after new scroll works.
- Out of scope here: vertical preview use (T8), phase/rail/shell/card-list, changing roving nav/drag legality.
- Assumptions in force: overlay is `aria-hidden`, pointer-draggable, not tab stop. Real overflow viewport keeps wheel/trackpad + card roving focus/`scrollIntoView`.

## Requirements

- Full hand wrapper uses `FieldRenderLayout.zones.get(pX:hand)` px placement + exactly one `box` height.
- Render every sorted hand card; no arrows/page status/imports.
- Player order ascending sequence; opponent visual mirror via CSS only.
- Native scrollbar hidden cross-browser; overlay track bottom edge does not change content box.
- Count badge bottom-right, z-index above cards, `pointer-events:none`.
- Shared scrollbar syncs on scroll, scroller/track resize, content key change; guard zero travel; clean listeners/observer/capture.

## Inputs

- `src/app/components/duel-field/HandBand.svelte`, `FieldBoard.svelte`, `CardControl.svelte`.
- `src/field/hand-pagination.ts`, `tests/unit/hand-pagination.test.ts` — delete after zero-consumer grep.
- `tests/component/HandBand.test.ts`, `tests/component/DuelField.test.ts`, `src/styles/app.css`.
- `ai_artefacts/manual_test_checklist.md` — append/update only T4 human checks; preserve all other sections.
- **From Depends:** `FieldBoard` has `renderLayout`; field cards use px placements; `FieldPlacement`; acceptance field scenarios/config.

## Required API

Create `src/app/components/OverlayScrollbar.svelte`:

```ts
export let axis: "horizontal" | "vertical";
export let scrollElement: HTMLElement | null = null;
export let contentSizeKey: string | number = 0;
export let dataCyPrefix: string;
```

Rendered `data-cy`:

- `${dataCyPrefix}-scrollbar`
- `${dataCyPrefix}-scrollbar-thumb`

Hand stable selectors:

- keep `field-hand-band-p0/p1`, `field-hand-p0/p1-viewport`.
- add `field-hand-p0/p1-count`.
- prefix scrollbar with `field-hand-p0/p1`.

## TDD

1. **Red** — new `OverlayScrollbar.test.ts`; replace pagination expectations with all-card/count/scroll expectations; Chromium 6/20 metrics.
2. **Green** — component + HandBand migration; then delete paging files.
3. **Refactor** — share axis math inside component only; no generic util package.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `hides overlay when content fits` | client=scroll size | hidden; finite thumb |
| `maps scroll offset to thumb transform` | horizontal + vertical stubs | proportional position |
| `maps thumb drag to native scroll offset` | pointer delta | `scrollLeft`/`scrollTop` changes; capture/release |
| `resyncs after content key and resize` | changed card count/track | thumb width/position update |
| `cleans observers and listeners` | destroy | no callbacks/change after destroy |
| `mounts every hand card` | 20 cards | 20 card articles; no page controls |
| `preserves hand feedback/nav contract` | actionable cards | `data-feedback-zone-id`; no `data-zone-id`; roving attrs intact |
| `six vs twenty keeps card height` | Chromium scenarios | equal card height; 6 bar hidden; 20 visible + overflow |
| `count paints above cards` | both players | badge text count; z-index > card |

## Impl steps

- [x] 1. Add `tests/component/OverlayScrollbar.test.ts`; mock `ResizeObserver`, element dimensions, pointer capture; prove red. Criterion: targeted test initially fails because component import is missing.
- [x] 2. Replace paging tests in `HandBand.test.ts` with all-card/overlay/count/lifecycle tests; prove red. Criterion: tests assert 20 mounted cards, count, stable selectors, no paging controls.
- [x] 3. Implement axis-aware `OverlayScrollbar.svelte`; passive scroll listener, observer, content-key reactive sync, pointer drag. Criterion: `OverlayScrollbar.test.ts` exits 0.
- [x] 4. Update `HandBand.svelte`: accept `placement:FieldPlacement`; delete page state/arrows/status; render all sorted cards inside bound viewport. Criterion: `HandBand.test.ts` exits 0.
- [x] 5. Add count + `OverlayScrollbar`; pass `contentSizeKey` combining card IDs + geometry width. Criterion: count and scrollbar selectors exist in component tests.
- [x] 6. Thread hand placement from `FieldBoard.renderLayout`; keep `data-feedback-zone-id` + drag/nav callbacks unchanged. Criterion: `DuelField.test.ts` exits 0.
- [x] 7. Replace hand CSS with fixed wrapper, hidden native bar, overlay/count layers, card gap=`--zone-gap`. Criterion: Chromium 6/20 metrics test exits 0.
- [x] 8. `rg "handPage|HAND_PAGE_SIZE|hand-pagination" src tests`; when zero runtime/test consumers remain, delete `src/field/hand-pagination.ts` + test. Criterion: residue command returns empty.
- [x] 9. Add 6/20 scenarios + Chromium tests; verify thumb drag. Criterion: ticket Playwright command exits 0.

## Outputs

- Created: `src/app/components/OverlayScrollbar.svelte`, `tests/component/OverlayScrollbar.test.ts`.
- Modified: HandBand/FieldBoard/styles/component + acceptance tests/scenarios.
- Deleted: `src/field/hand-pagination.ts`, `tests/unit/hand-pagination.test.ts` after clean grep.
- Cross-ticket API: `OverlayScrollbar` props above; T8 reuses unchanged.

## Validation

- [x] `npx vitest run tests/component/OverlayScrollbar.test.ts tests/component/HandBand.test.ts tests/component/DuelField.test.ts` → exit 0.
- [x] `test -z "$(rg -l 'handPage|HAND_PAGE_SIZE|hand-pagination' src tests || true)"` → success after deletion.
- [x] `npm run typecheck && npm run lint` → exit 0.
- [x] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/full-height-field.spec.ts --grep "hand|scrollbar"` → exit 0.
- [ ] manual check — wheel/trackpad + Arrow navigation reach offscreen hand cards; drag still starts. Criterion: human observes all three interactions in real duel.
- [x] app functional — `npm run build` exits 0.
- [x] commit msg draft: `feat(field): replace hand paging with overlay scroll` — Criterion: staged commit uses exact message.
