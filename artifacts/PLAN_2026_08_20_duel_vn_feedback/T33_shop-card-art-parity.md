# T33: Card art parity

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** Every card the story renders shows the whole card, exactly as the deck editor does — no cropped art.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-vn.md` shop item 3.
- This slice: one shared card tile for the story's card surfaces, matching the deck editor's rendering.
- Out of scope here: the rarity sort (T34), the zoom inspector (T35), the reveal flow (T36-T38).
- Assumptions in force: the deck editor's tile is the reference (commit `775b1a7` fixed it to render whole art); story tiles currently use `object-fit: cover`, which crops.

## Requirements

- The story's card tiles render the full card image with the card's aspect ratio, never cropped.
- One component is used by the set card list, the sell screen, the reveal screens and the collection screen.
- A card with no image renders the same placeholder treatment the editor uses.
- The tile keeps its rarity halo hook so rarity can still be shown where it applies.

## Inputs

- `src/deck-editor/components/CardTile.svelte` — the reference: renders `{#if card?.imageUrl}<img src={card.imageUrl} … data-cy={`deck-tile-image-${code}`} />` and sizes the image so the whole card is visible.
- `src/story/shop/ShopCardListScreen.svelte` — `.card-art` uses `object-fit: cover` (line ~207) and `story-shop-card-art-<code>`.
- `src/story/shop/BoosterOpeningScreen.svelte` — `.opening-art` also `object-fit: cover`, aspect `421 / 614`.
- `src/story/shop/BoosterResultsScreen.svelte`, `src/story/shop/ShopSellScreen.svelte` — the other card surfaces.
- `src/story/styles.css:77-97` — `.rarity-halo[data-rarity]` and the `--rarity-*` tokens.
- `src/decks/catalog/ocg-card-mapper.ts` — `DeckBuilderCardView` with `imageUrl: string | null` (ADR-039 static runtime URLs).
- Tests: `tests/component/story/`, `tests/component/deck-editor/`.

## From Depends

- T1 changed documentation only; `src/` is unchanged from `main`.

## TDD

1. **Red** — add `tests/component/story/story-card-tile.test.ts`: `renders the whole card, not a crop`, `renders a placeholder without an image`, `keeps the rarity halo hook`.
2. **Green** — add `StoryCardTile.svelte` and use it on all four surfaces.
3. **Refactor** — delete the four now-duplicated art rules from the story screens' scoped styles.

## Test plan

| Test                                             | Input                | Expect                                                              |
| ------------------------------------------------ | -------------------- | ------------------------------------------------------------------- |
| `renders the whole card, not a crop`             | card with `imageUrl` | the image rule uses `object-fit: contain` and the card aspect ratio |
| `renders a placeholder without an image`         | `imageUrl: null`     | placeholder element, no `img`                                       |
| `keeps the rarity halo hook`                     | rarity `ultra-rare`  | `data-rarity="ultra-rare"` and the `rarity-halo` class              |
| `set card list uses the shared tile`             | mount the list       | tiles carry the shared tile's `data-cy` prefix                      |
| `reveal and results screens use the shared tile` | mount both           | same                                                                |
| `deck editor tile is unchanged`                  | editor test          | still passes untouched                                              |

## Impl steps

- [ ] 1. Add the failing component test; run `npx vitest run tests/component/story/story-card-tile.test.ts`.
- [ ] 2. Create `src/story/components/StoryCardTile.svelte` with props `code: number`, `name: string`, `imageUrl: string | null`, `rarity?: ShopRarity`, `dataCyPrefix: string`, and `data-cy` values `${dataCyPrefix}-tile-${code}`, `${dataCyPrefix}-image-${code}`, `${dataCyPrefix}-placeholder-${code}`.
- [ ] 3. Style it in `src/story/styles.css` with `aspect-ratio: 421 / 614; object-fit: contain; width: 100%;` and the placeholder treatment.
- [ ] 4. Replace the inline card markup in `ShopCardListScreen.svelte`, `BoosterOpeningScreen.svelte`, `BoosterResultsScreen.svelte` and `ShopSellScreen.svelte` with `StoryCardTile`, preserving each screen's existing `data-cy` prefixes so their tests keep resolving.
- [ ] 5. Delete the now-unused `.card-art`, `.opening-art` and sibling rules from those components' scoped styles.
- [ ] 6. Run `npx vitest run tests/component/story tests/unit/data-cy-coverage.test.ts`.
- [ ] 7. Compare a card side by side with the deck editor's tile at the same width.

## Outputs

- Files touched: `src/story/components/StoryCardTile.svelte` (new), `src/story/shop/ShopCardListScreen.svelte`, `src/story/shop/BoosterOpeningScreen.svelte`, `src/story/shop/BoosterResultsScreen.svelte`, `src/story/shop/ShopSellScreen.svelte`, `src/story/styles.css`, `tests/component/story/story-card-tile.test.ts` (new).
- Behaviour change: story card art matches the deck editor.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/story` passes
- [ ] `npm run check:headless` passes
- [ ] manual: a card in the shop looks identical to the same card in the deck editor
- [ ] app functional — every story card surface still renders
- [ ] commit msg draft: `fix(story): one card tile that shows the whole card, like the editor`
