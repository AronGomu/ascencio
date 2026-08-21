# T34: Rarity sort

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T33
**Commit outcome:** The set card list has a tri-state rarity button that groups cards by rarity in either direction, or not at all.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-vn.md` card-list item 1, and card-list item 2 (the list keeps the shared preview panel, which it already uses).
- This slice: the toggle and the grouping in the set card list.
- Out of scope here: the reveal screens (T36-T38), the collection screen's own toggle (T29 shipped it using the same grouping module).
- Assumptions in force: the cycle is off → common-to-rarest → rarest-to-common → off; inside a rarity group cards are alphabetical; grouping is a view state, not persisted.

## Requirements

- The header row of the set card list, beside Back and the title, carries one button whose three states are labelled and announced.
- Grouping on renders a heading per rarity with the cards beneath it, alphabetical within.
- Grouping off renders the current flat list, unchanged.
- The button's state is reflected in an accessible attribute so a test and a screen reader can read it.

## Inputs

- `src/story/shop/ShopCardListScreen.svelte` — the screen: a header with Back and the set title, a card grid, and the preview area; `data-cy` values prefixed `story-shop-card-`.
- `src/story/collection/group-by-rarity.ts` — after T29: `groupByRarity(cards, direction: "common-first" | "rarest-first")` and `RARITY_ORDER`.
- `src/story/shop/data/shop-set-data.ts` — `ShopSetCard { code; name; rarity }` and the `RARITY_RANK` map already defined there.
- `src/story/model/story-state.ts` — the `ShopRarity` union.
- Tests: `tests/component/story/`, `tests/unit/story/`.

## From Depends

- T33 added `src/story/components/StoryCardTile.svelte` (props `code`, `name`, `imageUrl`, `rarity?`, `dataCyPrefix`; `data-cy` `${prefix}-tile-${code}`, `${prefix}-image-${code}`, `${prefix}-placeholder-${code}`) and switched the set card list, sell screen, opening screen and results screen onto it with whole-card `object-fit: contain` art.
- T29 (already merged earlier in the chain) added `groupByRarity` and `RARITY_ORDER` in `src/story/collection/group-by-rarity.ts`.

## TDD

1. **Red** — add `tests/component/story/set-list-rarity-sort.test.ts` with the cases below.
2. **Green** — add the toggle and render grouped sections.
3. **Refactor** — import `groupByRarity` rather than writing a second sort.

## Test plan

| Test                                          | Input             | Expect                                                  |
| --------------------------------------------- | ----------------- | ------------------------------------------------------- |
| `starts ungrouped`                            | mount             | no rarity headings; button state `off`                  |
| `first click groups common to rarest`         | click once        | headings in `RARITY_ORDER`; button state `common-first` |
| `second click reverses the groups`            | click twice       | headings reversed; button state `rarest-first`          |
| `third click removes grouping`                | click three times | no headings; button state `off`                         |
| `cards are alphabetical inside a group`       | grouped           | names ascending within each heading                     |
| `every card still appears exactly once`       | any state         | tile count equals the set's card count                  |
| `the preview panel still works while grouped` | click a card      | `[data-cy="card-preview-name"]` updates                 |

## Impl steps

- [ ] 1. Add the failing component test; run `npx vitest run tests/component/story/set-list-rarity-sort.test.ts`.
- [ ] 2. In `ShopCardListScreen.svelte`, add `let rarityGrouping: "off" | "common-first" | "rarest-first" = "off";` and a cycle function.
- [ ] 3. Add the button to the header row at `data-cy="story-shop-card-list-rarity-sort"` with `aria-pressed` and `data-state={rarityGrouping}`, labelled for each state.
- [ ] 4. When grouping is on, render `groupByRarity(cards, rarityGrouping)` as sections with a heading per rarity at `data-cy={`story-shop-card-list-group-${rarity}`}`.
- [ ] 5. Sort alphabetically inside each group and in the flat list.
- [ ] 6. Keep the existing preview wiring untouched.
- [ ] 7. Run `npx vitest run tests/component/story tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/shop/ShopCardListScreen.svelte`, `src/story/styles.css`, `tests/component/story/set-list-rarity-sort.test.ts` (new).
- Behaviour change: the set card list can group by rarity in both directions.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/story/set-list-rarity-sort.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: click the button three times and watch the list group, reverse, then flatten
- [ ] app functional — the set list still previews and still scrolls
- [ ] commit msg draft: `feat(shop): tri-state rarity grouping in the set card list`
