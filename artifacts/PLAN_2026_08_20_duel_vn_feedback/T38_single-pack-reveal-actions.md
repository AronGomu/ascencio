# T38: Single-pack reveal actions

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T37
**Commit outcome:** Opening a single pack shows only a Back button, and every card is already in the collection the moment you press open — skipping the reveal loses nothing.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-vn.md` reveal items 4 and 5.
- This slice: the button set for a one-pack opening, plus an explicit test that the credit happens at open time rather than at the end of the reveal.
- Out of scope here: the reveal mechanics (T36), multi-pack flow (T37), pricing.
- Assumptions in force: an unopened pack is not sellable (already true — the sell screen lists cards only); pressing open credits the collection immediately; the reveal is presentation; going straight to the collection shows the new cards.

## Requirements

- With exactly one pack, the reveal screen shows a single Back button — no "See results", no "Skip".
- With more than one pack, T37's buttons are unchanged.
- The `open-boosters` command credits the collection when opening starts; no later step adds cards.
- Leaving the reveal early — Back, or navigating away — never loses cards.
- A test asserts the collection contains the pack's cards before any card has been flipped.

## Inputs

- `src/story/shop/BoosterOpeningScreen.svelte` — after T36/T37: per-card `flipped` state, per-pack slicing with `packIndex`, and the buttons `story-shop-opening-next-pack`, `story-shop-opening-open-all`, `story-shop-opening-see-all`; the legacy `story-shop-opening-finish` ("See results") and `story-shop-opening-skip` are the ones to remove for the single-pack case.
- `src/story/model/story-reducer.ts` — the `open-boosters` case at lines ~244-271: it decrements `boosters` and adds every card in `command.cards` to `collection` in the same reduction, which is already the required timing; `acknowledge-opened` and `finish-opening` must not add anything.
- `src/story/model/story-state.ts` — `openedCards`, `openingMode`, `collection`.
- `src/story/shop/ShopSellScreen.svelte` — lists owned cards only; no pack rows (verified).
- Tests: `tests/component/story/`, `tests/unit/story/`.

## From Depends

- T37 added `src/story/shop/opened-card-quantities.ts` (`groupOpenedCards`), sliced the opening screen into packs of `PACK_SIZE` with `packIndex`, added `story-shop-opening-next-pack`, `story-shop-opening-open-all` and `story-shop-opening-see-all`, extracted `src/story/components/RaritySortButton.svelte`, and rewrote `BoosterResultsScreen.svelte` into the set-list layout with quantity badges at `story-shop-results-quantity-<code>`.

## TDD

1. **Red** — add `tests/component/story/single-pack-reveal.test.ts` and `tests/unit/story/credit-at-open.test.ts`.
2. **Green** — branch the button set on pack count; assert (and keep) the credit timing.
3. **Refactor** — delete the now-dead `story-shop-opening-finish` and `story-shop-opening-skip` markup and styles if no path still uses them.

## Test plan

| Test                                        | Input                                     | Expect                                                               |
| ------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `a single pack shows only Back`             | 1 pack                                    | `story-shop-opening-back` present; no finish, skip, next or open-all |
| `several packs keep the multi-pack buttons` | 3 packs                                   | next / open-all present as T37 defined                               |
| `the collection is credited at open`        | dispatch `open-boosters` with 9 cards     | `collection` already holds all nine before any flip                  |
| `acknowledging adds nothing`                | `acknowledge-opened` after opening        | collection unchanged                                                 |
| `finishing adds nothing`                    | `finish-opening`                          | collection unchanged                                                 |
| `leaving early keeps the cards`             | open, press Back after zero flips         | collection still holds all nine                                      |
| `packs are still not sellable`              | mount the sell screen with unopened packs | no pack rows                                                         |

## Impl steps

- [ ] 1. Add the failing tests; run `npx vitest run tests/unit/story/credit-at-open.test.ts tests/component/story/single-pack-reveal.test.ts`.
- [ ] 2. In `BoosterOpeningScreen.svelte`, compute `packCount` and branch: when it is 1, render only a Back button at `data-cy="story-shop-opening-back"`.
- [ ] 3. Remove the unconditional `story-shop-opening-finish` and `story-shop-opening-skip` buttons; keep the multi-pack buttons from T37 behind `packCount > 1`.
- [ ] 4. Wire Back to the same destination "See results" used for a single pack: the shop browse screen the visit came from (`shopReturnScreen`).
- [ ] 5. Confirm in `story-reducer.ts` that `open-boosters` is the only case touching `collection` during an opening; add a comment recording that the reveal is presentation only.
- [ ] 6. Delete the dead styles for the removed buttons.
- [ ] 7. Run `npx vitest run tests/component/story tests/unit/story tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/shop/BoosterOpeningScreen.svelte`, `src/story/model/story-reducer.ts` (comment only), `src/story/styles.css`, `tests/component/story/single-pack-reveal.test.ts` (new), `tests/unit/story/credit-at-open.test.ts` (new).
- Behaviour change: a one-pack opening has a single, obvious exit.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/story/single-pack-reveal.test.ts` passes
- [ ] `npx vitest run tests/unit/story/credit-at-open.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: buy one pack, press open, leave immediately, open the collection — the cards are there
- [ ] app functional — multi-pack opening still works end to end
- [ ] commit msg draft: `feat(shop): one pack, one Back button, and cards credited the moment you open`
