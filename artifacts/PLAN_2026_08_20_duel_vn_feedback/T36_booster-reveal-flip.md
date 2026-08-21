# T36: Booster reveal flip

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T35
**Commit outcome:** A pack reveals nine face-down cards you flip by clicking, with the rarity halo fading in on hover, a 2× zoom inspector, and an auto-flip option remembered in the save.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-vn.md` reveal items 1 (single-pack half), 2 and 3.
- This slice: the reveal surface itself — face-down cards, the flip, the layout and the auto-flip setting.
- Out of scope here: open-all and the results list (T37), the single-pack button set and credit timing (T38).
- Assumptions in force: nine cards on one full-width row on desktop, one scrollable column on mobile, centred both axes; hover fades in the rarity halo and zooms 2× with the inspector from T35; auto-flip runs left to right about every 450 ms, is remembered in the story save, defaults to off, and reduced motion cuts the animation but not the pacing.

## Requirements

- Cards start face down; clicking one flips it with an animation.
- Hovering a face-down card fades in its rarity halo — the rarity is visible before the face is.
- Hovering any card zooms it 2× and shows the `CardZoomInspector`.
- A checkbox toggles auto-flip; when on, cards flip left to right every ~450 ms without input.
- The auto-flip preference persists in the story save and defaults to off.
- Layout: one row of nine on ≥1024 px, one scrollable column below that, centred on both axes.

## Inputs

- `src/story/shop/BoosterOpeningScreen.svelte` — the current screen: `revealed` counter, click-anywhere `advance()`, `.face-down` stack, `.revealed-grid` of `repeat(auto-fill, minmax(6rem, 1fr))`, a `See results` button and a `Skip` button; `data-cy` values `story-shop-opening`, `story-shop-opening-progress`, `story-shop-opening-stack`, `story-shop-opening-facedown`, `story-shop-opening-grid`, `story-shop-opening-card-<i>`, `story-shop-opening-art-<i>`, `story-shop-opening-name-<i>`, `story-shop-opening-finish`, `story-shop-opening-skip`.
- `src/story/components/CardZoomInspector.svelte` — after T35: props `card`, `rarity?`, `anchor`, `scale = 2`; `data-cy` `card-zoom-inspector`.
- `src/story/components/StoryCardTile.svelte` — after T33: the whole-card tile.
- `src/story/playback/story-playback-settings.ts` and `story-playback-settings-store.ts` — the existing pattern for a persisted playback preference (Auto/Skip); follow it for auto-flip.
- `src/story/model/story-state.ts` — `OpenedCard { code; rarity }`, `openedCards`, `openingMode`.
- `src/story/styles.css` — `--rarity-*`, `.rarity-halo[data-rarity]`, the reduced-motion block.
- `src/story/shop/data/shop-pricing.ts` — `PACK_SIZE`.
- Tests: `tests/component/story/`.

## From Depends

- T35 added `src/story/components/CardZoomInspector.svelte` (`data-cy` `card-zoom-inspector`, `card-zoom-inspector-card`, `card-zoom-inspector-window`, `card-zoom-inspector-name`, `card-zoom-inspector-stats`, `card-zoom-inspector-text`) and the pure `placeZoomWindow(anchor, viewport, windowSize)` in `src/story/components/zoom-window-position.ts`. T33 added `StoryCardTile.svelte`.

## TDD

1. **Red** — add `tests/component/story/booster-reveal.test.ts` with the cases below.
2. **Green** — rewrite the opening screen around a per-card flip state.
3. **Refactor** — extract the auto-flip timer into a small module so it can be tested with fake timers without the DOM.

## Test plan

| Test                                              | Input                                        | Expect                                                 |
| ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `all cards start face down`                       | 9 cards                                      | nine face-down tiles, no faces                         |
| `clicking a card flips only that card`            | click the third                              | the third shows its face; the rest stay down           |
| `hovering a face-down card shows its rarity halo` | hover                                        | `data-rarity` on that tile and the halo class applied  |
| `hovering shows the zoom inspector`               | hover                                        | `[data-cy="card-zoom-inspector"]` present              |
| `auto-flip reveals in order`                      | enable, advance timers by 450 ms three times | cards 1, 2, 3 face up in that order                    |
| `auto-flip preference persists`                   | enable, remount                              | checkbox still on                                      |
| `auto-flip defaults to off`                       | fresh save                                   | checkbox off                                           |
| `reduced motion keeps the pacing`                 | `prefers-reduced-motion: reduce`, auto on    | still one flip per 450 ms; no flip animation class     |
| `layout is one row on desktop`                    | stylesheet                                   | the ≥1024 px rule declares `repeat(9, minmax(0, 1fr))` |

## Impl steps

- [ ] 1. Add the failing component test; run `npx vitest run tests/component/story/booster-reveal.test.ts`.
- [ ] 2. Replace the `revealed` counter in `BoosterOpeningScreen.svelte` with `flipped: boolean[]` sized to the pack.
- [ ] 3. Render every card immediately as a face-down tile at `data-cy={`story-shop-opening-card-${index}`}`, adding `data-rarity` and the `rarity-halo` class so the halo can fade in on hover.
- [ ] 4. Flip on click of that card only; remove the click-anywhere `advance()`.
- [ ] 5. Add the flip animation with a `@media (prefers-reduced-motion: no-preference)` guard, and the halo fade-in transition.
- [ ] 6. Mount `CardZoomInspector` on hover, anchored to the hovered tile's rect.
- [ ] 7. Create `src/story/shop/auto-flip.ts` exporting `createAutoFlip({ total, intervalMs = 450, onFlip })` with `start()` and `stop()`; drive it from the checkbox at `data-cy="story-shop-opening-auto-flip"`.
- [ ] 8. Persist the preference beside the existing playback settings so it rides in the story save; default `false`.
- [ ] 9. Restyle `.revealed-grid`: `@media (min-width: 1024px) { grid-template-columns: repeat(9, minmax(0, 1fr)); }`, one column below, centred with `place-content: center` and a minimal margin.
- [ ] 10. Run `npx vitest run tests/component/story tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/shop/BoosterOpeningScreen.svelte`, `src/story/shop/auto-flip.ts` (new), `src/story/playback/story-playback-settings.ts`, `src/story/styles.css`, `tests/component/story/booster-reveal.test.ts` (new).
- Behaviour change: opening a pack is a per-card reveal instead of a counter.
- Migration/config: the playback settings gain one optional field; older saves read as `false`.

## Validation

- [ ] `npx vitest run tests/component/story/booster-reveal.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: open a pack, hover to see rarity, click to flip, tick auto-flip and watch it run
- [ ] app functional — the pack's contents are the same cards as before
- [ ] commit msg draft: `feat(shop): face-down pack reveal with rarity halos, zoom and auto-flip`
