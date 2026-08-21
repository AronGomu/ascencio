# T35: Card zoom inspector

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T33
**Commit outcome:** A reusable inspector exists that magnifies the actual card and floats its text beside it — a different component from the docked preview panel.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket builds the component `feedback-vn.md` reveal item 3 asks for.
- This slice: the component and its placement maths, with tests. T36 mounts it on the reveal screen.
- Out of scope here: the reveal flow (T36), the docked `CardPreviewPanel` (unchanged, still used by the set list and collection).
- Assumptions in force: this is a **new** component, used only on screens without a fixed preview panel — today only the reveal screens; hover magnifies the real card 2× and fades in the orange selection halo; the text window floats next to the zoomed card.

## Requirements

- `CardZoomInspector` takes an anchor rectangle plus the card and renders the magnified card with a floating text window beside it.
- The text window flips to the other side when it would leave the viewport, and is clamped vertically.
- The halo fades in on appearance and respects `prefers-reduced-motion`.
- The component is pointer-driven and never traps focus; it is decoration over a live screen.
- The magnified card uses the same whole-card rendering as the story's card tile.

## Inputs

- `src/story/components/StoryCardTile.svelte` — after T33: props `code`, `name`, `imageUrl`, `rarity?`, `dataCyPrefix`; whole-card `object-fit: contain` rendering.
- `src/battle/app/presentation/floating-window-position.ts` — the duel's existing placement maths for a floating window anchored to an element; read it as the model. It is battle-internal, so the story cannot import it: write the story's own small module and keep the same flip-and-clamp behaviour.
- `src/battle/app/components/duel-field/HandZoomOverlay.svelte` — the duel's anchored-zoom precedent for clamping against a frame.
- `src/decks/catalog/ocg-card-mapper.ts` — `DeckBuilderCardView` fields available for the text window: `name`, `description`, `attribute`, `race`, `levelRankLink`, `attack`, `defense`.
- `src/story/styles.css` — `--rarity-*` tokens, `.rarity-halo[data-rarity]`, and the story's motion rules.
- Tests: `tests/component/story/`, `tests/unit/story/`.

## From Depends

- T33 added `src/story/components/StoryCardTile.svelte` and moved the story's four card surfaces onto it, with the art rules living in `src/story/styles.css` at `aspect-ratio: 421 / 614; object-fit: contain`.

## TDD

1. **Red** — add `tests/unit/story/zoom-window-position.test.ts` (pure placement) and `tests/component/story/card-zoom-inspector.test.ts` (render + halo).
2. **Green** — write `src/story/components/zoom-window-position.ts` and `CardZoomInspector.svelte`.
3. **Refactor** — none; keep the placement module pure and DOM-free.

## Test plan

| Test                                               | Input                            | Expect                                            |
| -------------------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `places the text window to the right when it fits` | anchor at x=100, viewport 1280   | `side: "right"`, left edge beyond the zoomed card |
| `flips to the left when it would overflow`         | anchor near the right edge       | `side: "left"`                                    |
| `clamps vertically inside the viewport`            | anchor near the bottom           | top ≥ 8, bottom ≤ viewport − 8                    |
| `magnifies the card twice`                         | anchor 100×146                   | rendered box is 200×292                           |
| `renders name, stats and effect text`              | a monster card                   | name, `ATK`/`DEF` row and description all present |
| `applies the rarity halo`                          | rarity `secret-rare`             | `data-rarity="secret-rare"` on the zoom frame     |
| `drops the fade under reduced motion`              | `prefers-reduced-motion: reduce` | no transition declared on the halo                |

## Impl steps

- [ ] 1. Add the failing tests; run `npx vitest run tests/unit/story/zoom-window-position.test.ts`.
- [ ] 2. Create `src/story/components/zoom-window-position.ts` exporting `placeZoomWindow(anchor: { left; top; width; height }, viewport: { width; height }, windowSize: { width; height }): { side: "left" | "right"; left: number; top: number }`.
- [ ] 3. Create `src/story/components/CardZoomInspector.svelte` with props `card: DeckBuilderCardView`, `rarity?: ShopRarity`, `anchor`, `scale = 2`; `data-cy` values `card-zoom-inspector`, `card-zoom-inspector-card`, `card-zoom-inspector-window`, `card-zoom-inspector-name`, `card-zoom-inspector-stats`, `card-zoom-inspector-text`.
- [ ] 4. Render the magnified card through `StoryCardTile` inside a frame carrying `class="rarity-halo"` and `data-rarity`.
- [ ] 5. Compose the stats line from `attribute`, `race`, `levelRankLink`, `attack`, `defense`, omitting what a spell or trap does not have.
- [ ] 6. Add the styles in `src/story/styles.css`: halo fade-in, floating window surface, and a `@media (prefers-reduced-motion: reduce)` branch dropping the transition.
- [ ] 7. Run `npx vitest run tests/component/story/card-zoom-inspector.test.ts tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/components/zoom-window-position.ts` (new), `src/story/components/CardZoomInspector.svelte` (new), `src/story/styles.css`, `tests/unit/story/zoom-window-position.test.ts` (new), `tests/component/story/card-zoom-inspector.test.ts` (new).
- Behaviour change: none yet — nothing mounts it until T36.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/unit/story/zoom-window-position.test.ts` passes
- [ ] `npx vitest run tests/component/story/card-zoom-inspector.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] app functional — no screen changed
- [ ] commit msg draft: `feat(story): a card zoom inspector with a floating text window`
