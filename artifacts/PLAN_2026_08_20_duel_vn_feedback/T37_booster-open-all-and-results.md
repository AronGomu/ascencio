# T37: Open-all and results

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T36
**Commit outcome:** Boosters open one pack at a time with an "open all remaining" option, and the results list shows unique cards with quantities and the same rarity grouping as a set list.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is the rest of `feedback-vn.md` reveal item 1.
- This slice: multi-pack flow and the results screen's layout.
- Out of scope here: the single-pack button set and credit timing (T38), the reveal mechanics themselves (T36).
- Assumptions in force: one pack is revealed at a time; "open all" jumps straight to the results list; the results list reuses the set-card-list layout, shows quantities instead of duplicates, and carries the same tri-state rarity grouping; after revealing pack by pack, a "see all" button opens the same list.

## Requirements

- Opening N packs reveals pack 1, then offers "Next pack" and "Open all remaining".
- "Open all remaining" reveals nothing card by card and goes to the results list with every remaining card included.
- The results list groups duplicates into one tile with a quantity badge.
- The results list carries the tri-state rarity grouping button with the same semantics as the set card list.
- After the last pack, a "See all" button opens the same results list.

## Inputs

- `src/story/shop/BoosterOpeningScreen.svelte` — after T36: per-card `flipped` state, `story-shop-opening-auto-flip`, the nine-across layout, `CardZoomInspector` on hover, and the pack progress line `story-shop-opening-progress`.
- `src/story/shop/BoosterResultsScreen.svelte` — the current recap screen (`data-cy` prefixed `story-shop-results-`).
- `src/story/shop/BoosterInventoryDialog.svelte` — where a count of packs is chosen before opening.
- `src/story/model/story-reducer.ts` — `open-boosters` with `picks: { setId; count }[]`, `cards: OpenedCard[]`, `mode: "sequential" | "all"`; `acknowledge-opened`; `finish-opening`.
- `src/story/model/story-state.ts` — `openedCards: readonly OpenedCard[] | null`, `openingMode: "sequential" | "all" | null`.
- `src/story/collection/group-by-rarity.ts` — after T29: `groupByRarity(cards, direction)` and `RARITY_ORDER`.
- `src/story/shop/ShopCardListScreen.svelte` — after T34 it holds the tri-state button pattern to mirror (`story-shop-card-list-rarity-sort`, `data-state`).
- `src/story/shop/data/shop-pricing.ts` — `PACK_SIZE`.
- Tests: `tests/component/story/`.

## From Depends

- T36 rewrote `BoosterOpeningScreen.svelte` around `flipped: boolean[]`, added `src/story/shop/auto-flip.ts` (`createAutoFlip({ total, intervalMs, onFlip })`), persisted the auto-flip preference beside the story playback settings (default off), mounted `CardZoomInspector` on hover, and restyled the grid to nine columns at ≥1024 px.

## TDD

1. **Red** — add `tests/component/story/booster-open-all.test.ts` and `tests/unit/story/opened-card-quantities.test.ts`.
2. **Green** — add per-pack progression, the open-all path, and the quantity grouping in the results screen.
3. **Refactor** — reuse the rarity toggle markup from the set card list by extracting a small `RaritySortButton.svelte`.

## Test plan

| Test                                            | Input                     | Expect                                                     |
| ----------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| `reveals one pack at a time`                    | 3 packs                   | nine tiles; progress reads `Pack 1 of 3`                   |
| `Next pack advances`                            | finish pack 1, click Next | fresh nine face-down tiles; `Pack 2 of 3`                  |
| `Open all remaining skips to the results`       | click Open all            | results list mounted; every remaining card included        |
| `duplicates collapse into a quantity`           | 3 copies of one code      | one tile with a quantity badge reading `3`                 |
| `unique cards show no quantity badge`           | 1 copy                    | no badge for that tile                                     |
| `results carry the tri-state rarity grouping`   | click the button twice    | groups reversed, same states as the set list               |
| `See all opens the results after the last pack` | finish the last pack      | `[data-cy="story-shop-opening-see-all"]` opens the results |
| `every opened card is accounted for`            | 3 packs                   | the sum of quantities equals `3 * PACK_SIZE`               |

## Impl steps

- [ ] 1. Add the failing tests; run `npx vitest run tests/unit/story/opened-card-quantities.test.ts`.
- [ ] 2. Create `src/story/shop/opened-card-quantities.ts` exporting `groupOpenedCards(cards: readonly OpenedCard[]): readonly { code: number; rarity: ShopRarity; quantity: number }[]`.
- [ ] 3. In `BoosterOpeningScreen.svelte`, slice `openedCards` into packs of `PACK_SIZE` and keep a `packIndex`; render one pack at a time.
- [ ] 4. Add `story-shop-opening-next-pack`, `story-shop-opening-open-all` and `story-shop-opening-see-all` buttons, showing each only when it applies.
- [ ] 5. Wire Open all to jump straight to the results screen with the remaining cards.
- [ ] 6. Extract `src/story/components/RaritySortButton.svelte` from the set card list's toggle (same `data-state` contract) and use it on both screens.
- [ ] 7. Rewrite `BoosterResultsScreen.svelte` to use the set-card-list layout: `StoryCardTile` grid, optional rarity groups, and a quantity badge at `data-cy={`story-shop-results-quantity-${code}`}`.
- [ ] 8. Run `npx vitest run tests/component/story tests/unit/story tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/shop/opened-card-quantities.ts` (new), `src/story/shop/BoosterOpeningScreen.svelte`, `src/story/shop/BoosterResultsScreen.svelte`, `src/story/components/RaritySortButton.svelte` (new), `src/story/shop/ShopCardListScreen.svelte`, `tests/component/story/booster-open-all.test.ts` (new), `tests/unit/story/opened-card-quantities.test.ts` (new).
- Behaviour change: multi-pack opening is sequential with an escape hatch, and results are deduplicated.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/story/booster-open-all.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: buy three packs, open one, then open all remaining and read the quantity list
- [ ] app functional — the collection still receives every card
- [ ] commit msg draft: `feat(shop): pack-by-pack opening with open-all and a deduplicated results list`
