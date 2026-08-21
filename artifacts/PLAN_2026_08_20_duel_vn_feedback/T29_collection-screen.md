# T29: Collection screen

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T22
**Commit outcome:** A browsable collection screen exists for both contexts, grouping by rarity, showing owned counts, with a "show every existing card" checkbox that is off by default.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket builds the new-feature screen from `feedback-vn.md`.
- This slice: the screen and its routes. Its entry buttons come in T30.
- Out of scope here: the entry points (T30), filters and search beyond what is listed here (explicitly a later evolution), deck editing.
- Assumptions in force: a collection belongs to one story save; free play owns everything, so its collection screen shows the whole database without owned counts; the show-all checkbox belongs to this screen only — the deck catalog never gets it.

## Requirements

- `#/story/collection` lists the loaded save's owned cards; `#/free-play/collection` lists the whole card database.
- Cards are grouped by rarity when grouping is on, alphabetical inside each group; ungrouped is alphabetical.
- Each owned card shows its owned count; free play shows no counts.
- A "Show every existing card" checkbox, unchecked by default, adds unowned cards rendered dimmed in the story context.
- The screen reuses the shared card preview panel from the shell (`CardPreviewPanel`), not a new inspector.
- The layout matches the set card list: same grid, same tile proportions.

## Inputs

- `src/story/decks/card-ownership.ts` — after T22: `CardOwnership { ownedCount(code): number; isUnlimited: boolean }`, `storyCardOwnership(state)`, `unlimitedCardOwnership()`, all exported from `src/story/index.ts`.
- `src/decks/catalog/active-catalog.ts` — `activeCatalog(): readonly DeckBuilderCardView[]` with `code`, `name`, `description`, `imageUrl`, `attribute`, `race`, `levelRankLink`, `attack`, `defense`.
- `src/story/shop/ShopCardListScreen.svelte` — the layout to match (grid, `story-shop-card-art-<code>` tiles, preview area).
- `src/story/shop/data/shop-rarity.ts` and `src/story/model/story-state.ts` — `ShopRarity` union: `common | rare | super-rare | ultra-rare | secret-rare | ultimate-rare | ghost-rare`.
- `src/story/styles.css:8-13,77-97` — the `--rarity-halo-*` tokens and `.rarity-halo[data-rarity]`.
- `src/shell/index.ts` — `CardPreviewPanel`, `OverlayScrollbar`, `type CardPreviewView`.
- `src/shell/routes.ts` — after T14: `{ kind: "story-collection" }` and `{ kind: "free-play-collection" }`.
- Tests: `tests/component/story/`, `tests/unit/story/`.

## From Depends

- T22 added `src/story/decks/card-ownership.ts` with the `CardOwnership` interface plus `storyCardOwnership(state)` and `unlimitedCardOwnership()`, exported them from `src/story/index.ts`, listed them in `tests/unit/domain-boundaries.test.ts`, and recorded the invariant in `docs/ADR/050_ADR_card_ownership_invariant.md`.

## TDD

1. **Red** — add `tests/component/story/collection-screen.test.ts` with the cases below.
2. **Green** — build `CollectionScreen.svelte` plus a pure grouping module.
3. **Refactor** — extract the rarity grouping into `src/story/collection/group-by-rarity.ts` so T34 can reuse it for the set list.

## Test plan

| Test                                                | Input                              | Expect                                                   |
| --------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| `story collection lists owned cards with counts`    | `collection: { 4007: 2, 4008: 1 }` | two tiles; counts `2` and `1`                            |
| `unowned cards are hidden by default`               | catalog of 5, own 2                | two tiles; checkbox unchecked                            |
| `show-all reveals unowned cards dimmed`             | tick the checkbox                  | five tiles; the three unowned carry the dimmed class     |
| `free play shows the whole database without counts` | unlimited ownership                | every catalog card; no count elements                    |
| `grouping by rarity orders groups and sorts inside` | mixed rarities                     | group order common→ghost-rare; names alphabetical inside |
| `ungrouped is alphabetical`                         | grouping off                       | one flat list, alphabetical                              |
| `selecting a card fills the shared preview`         | click a tile                       | `[data-cy="card-preview-name"]` shows that card's name   |

## Impl steps

- [ ] 1. Add the failing component test file; run `npx vitest run tests/component/story/collection-screen.test.ts`.
- [ ] 2. Create `src/story/collection/group-by-rarity.ts` exporting `groupByRarity(cards, direction: "common-first" | "rarest-first")` and `RARITY_ORDER`.
- [ ] 3. Create `src/story/collection/CollectionScreen.svelte` with `data-cy` values `collection-screen`, `collection-show-all`, `collection-group-toggle`, `collection-card-<code>`, `collection-count-<code>`, `collection-back`.
- [ ] 4. Take props `ownership: CardOwnership`, `cards: readonly DeckBuilderCardView[]`, `rarityByCode: ReadonlyMap<number, ShopRarity>`, `onback`.
- [ ] 5. Render the shared `CardPreviewPanel` from `src/shell/index.ts`, feeding it the selected card and its `imageUrl` through `staticImageUrl`.
- [ ] 6. Mount the screen in `src/shell/AppShell.svelte` for `{ kind: "story-collection" }` and `{ kind: "free-play-collection" }`, building ownership from the loaded save or `unlimitedCardOwnership()`.
- [ ] 7. Redirect `#/story/collection` to `#/` when no save is loaded, matching T23's rule for story deck routes.
- [ ] 8. Style the grid to match `ShopCardListScreen.svelte`; reuse the rarity halo tokens for the group headings.
- [ ] 9. Run `npx vitest run tests/component/story tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/collection/group-by-rarity.ts` (new), `src/story/collection/CollectionScreen.svelte` (new), `src/shell/AppShell.svelte`, `src/story/styles.css`, `tests/component/story/collection-screen.test.ts` (new).
- Behaviour change: two new reachable screens.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/story/collection-screen.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: `#/story/collection` shows your cards with counts; ticking show-all reveals the rest dimmed
- [ ] app functional — the shop and editor are untouched
- [ ] commit msg draft: `feat(collection): a browsable collection screen for a save and for free play`
