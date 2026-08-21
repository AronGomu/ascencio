# T26: Sell confirmation

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T25
**Commit outcome:** Selling cards that a deck depends on shows a dialog naming those decks before the sale commits, and the sale still goes through if you accept.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This is the sell-screen half of the ownership invariant.
- This slice: a pre-commit warning. Selling stays unrestricted by decision — the dialog informs, it does not block.
- Out of scope here: the legality rule itself (T25), the encounter gate (T27), pack selling (packs are already unsellable).
- Assumptions in force: the dialog lists affected decks by name; confirming sells and leaves those decks illegal; cancelling changes nothing.

## Requirements

- Before dispatching `sell-cards`, compute which of the save's decks would hold more copies of a code than remain owned.
- If the set is non-empty, show a dialog naming each deck and the cards at fault, with Confirm and Cancel.
- Confirm dispatches the sale unchanged; Cancel dispatches nothing.
- A sale that breaks nothing commits without a dialog.
- The cancelling action uses the red danger styling.

## Inputs

- `src/story/shop/ShopSellScreen.svelte` — the sell UI: owned cards with a stepper per card (`story-shop-sell-card-*`, `story-shop-sell-stepper-*`, `story-shop-sell-minus-*`), a total, and a confirm that dispatches the sale.
- `src/story/model/story-reducer.ts` — the `sell-cards` case: `items: readonly { code; quantity; rarity }[]`, refusing when `state.collection[code] < quantity`, paying `SELL_PRICE_DP[rarity]`.
- `src/story/shop/data/shop-pricing.ts` — `SELL_PRICE_DP`.
- `src/story/model/story-state.ts` — after T18: `decks: readonly StoryDeck[]`.
- `src/decks/deck-validation.ts` — after T25 it emits `not-owned` errors given a `CardOwnership`.
- `src/story/decks/card-ownership.ts` — after T22: `storyCardOwnership(state)`.
- Tests: `tests/component/story/`, `tests/unit/story/`.

## From Depends

- T25 added the `not-owned` issue code to `DeckValidationIssue["code"]` in `src/decks/deck-contracts.ts`, extended `validateDeckDraft` with an optional `ownership?: CardOwnership` that emits one `not-owned` error per over-used code, and added the illegal badge `[data-cy="deck-library-illegal-<id>"]` to `DeckLibrary.svelte`.

## TDD

1. **Red** — add `tests/unit/story/sell-impact.test.ts` (the pure calculation) and `tests/component/story/sell-confirmation.test.ts` (the dialog).
2. **Green** — add `decksBrokenBySale(state, items)` and the dialog.
3. **Refactor** — reuse the ownership contract rather than re-reading the collection map inline.

## Test plan

| Test                                           | Input                      | Expect                                                                 |
| ---------------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| `a harmless sale breaks nothing`               | sell a card no deck uses   | `decksBrokenBySale` returns `[]`                                       |
| `selling below a deck's usage names that deck` | deck uses 2, own 2, sell 1 | one entry naming the deck and the code                                 |
| `selling spare copies breaks nothing`          | deck uses 1, own 3, sell 2 | `[]`                                                                   |
| `several decks are all named`                  | two decks use the card     | two entries                                                            |
| `the dialog appears before the sale`           | confirm a breaking sale    | `[data-cy="story-sell-impact-dialog"]`; no `sell-cards` dispatched yet |
| `confirming commits the sale`                  | press confirm              | exactly one `sell-cards` with the original items                       |
| `cancelling changes nothing`                   | press cancel               | no dispatch; dialog closed; steppers keep their values                 |
| `a harmless sale skips the dialog`             | confirm a harmless sale    | no dialog; `sell-cards` dispatched                                     |

## Impl steps

- [ ] 1. Add the failing tests; run `npx vitest run tests/unit/story/sell-impact.test.ts`.
- [ ] 2. Create `src/story/shop/sell-impact.ts` exporting `decksBrokenBySale(state: StoryState, items: readonly { code: number; quantity: number }[]): readonly { deckId: string; deckName: string; codes: readonly number[] }[]`.
- [ ] 3. Implement it by projecting the post-sale collection, building ownership from it, and counting each deck's used copies per code.
- [ ] 4. Create `src/story/shop/SellImpactDialog.svelte` with `data-cy` values `story-sell-impact-dialog`, `story-sell-impact-deck-<deckId>`, `story-sell-impact-confirm`, `story-sell-impact-cancel`; the cancel button carries the story danger class.
- [ ] 5. In `ShopSellScreen.svelte`, run the calculation on confirm; open the dialog when it is non-empty, otherwise dispatch straight through.
- [ ] 6. Wire confirm to dispatch the original `sell-cards` payload and cancel to close without dispatching.
- [ ] 7. Run `npx vitest run tests/unit/story tests/component/story tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/shop/sell-impact.ts` (new), `src/story/shop/SellImpactDialog.svelte` (new), `src/story/shop/ShopSellScreen.svelte`, `tests/unit/story/sell-impact.test.ts` (new), `tests/component/story/sell-confirmation.test.ts` (new).
- Behaviour change: a breaking sale warns first.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/unit/story/sell-impact.test.ts` passes
- [ ] `npx vitest run tests/component/story` passes
- [ ] `npm run check:headless` passes
- [ ] manual: sell a staple from your deck — the dialog names the deck; confirm sells, cancel does not
- [ ] app functional — ordinary sales are unchanged
- [ ] commit msg draft: `feat(shop): warn which decks a sale would break before it commits`
