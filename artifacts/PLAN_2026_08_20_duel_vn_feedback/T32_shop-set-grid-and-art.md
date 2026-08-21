# T32: Set grid and art

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T31
**Commit outcome:** The shop shows illustrated set tiles, four per row on a desktop screen, with the four most recent releases in their own chronological row.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-vn.md` shop items 1 (render half) and 2.
- This slice: the browse screen's tiles and grid. The images themselves already exist on disk from T31.
- Out of scope here: the card list (T33/T34), the reveal (T35-T38), pricing.
- Assumptions in force: at ≥1280 px exactly four tiles per row with vertical scrolling; "Latest Released" shows the four most recent released sets in chronological order; sets without an image render a typographic tile with the set code and year.

## Requirements

- Each set tile renders `{BASE_URL}runtime/sets/{setId}.jpg` when the set has an image, and a typographic fallback tile otherwise.
- The all-sets grid is exactly four columns at ≥1280 px and scrolls vertically; below that it degrades to two, then one.
- The latest row shows the last four released sets, oldest to newest.
- A tile that fails to load falls back to the typographic tile rather than a broken image.
- Locked (unreleased) sets keep their current dimmed, non-interactive treatment.

## Inputs

- `src/story/shop/ShopBrowseScreen.svelte` — current markup: `story-shop-browse`, `story-shop-latest-row`, `story-shop-latest-scroll`, `story-shop-latest-<id>`, `story-shop-set-grid`, `story-shop-set-<id>`, `story-shop-set-name-<id>`, `story-shop-set-year-<id>`; `latestRow = [...released].reverse()` today (all released sets, newest first); `.set-grid` is `repeat(auto-fill, minmax(11rem, 1fr))`.
- `src/story/shop/data/shop-set-data.ts` — `ShopSetEntry { id; name; releaseYear; released; cards }`, `SHOP_SET_DATA_URL`, `SHOP_SET_DATA_CACHE`.
- `scripts/lib/set-images.ts` — after T31: `setImageRuntimePath(setId)` returning `runtime/sets/{setId}.jpg`, plus the manifest with its `missing` list.
- `src/story/shop/ShopSetDialog.svelte` — opened from a tile; unchanged here.
- Tests: `tests/component/story/`, `tests/unit/story/`.

## From Depends

- T31 added `scripts/download-set-images.ts`, `scripts/verify-set-images.ts` and `scripts/lib/set-images.ts` (`buildSetImageManifest`, `verifySetImageManifest`, `setImageRuntimePath`), wrote images to `generated/set-images/` with a sha256 `manifest.json` carrying `files` and `missing`, extended `scripts/lib/vite-runtime-assets.ts` to serve `runtime/sets/*`, added `assets:sets` / `assets:sets:verify` to `package.json`, and recorded `docs/ADR/052_ADR_set_image_pipeline.md`.

## TDD

1. **Red** — add `tests/component/story/shop-set-tiles.test.ts` with the cases below.
2. **Green** — add a `SetTile.svelte` with the image/fallback logic and fix the grid and latest row.
3. **Refactor** — pull the four-most-recent calculation into a pure function so it is testable without the DOM.

## Test plan

| Test                                                  | Input                     | Expect                                                  |
| ----------------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| `renders the set image when one exists`               | set `LOB`                 | `img` whose `src` ends `runtime/sets/LOB.jpg`           |
| `renders a typographic tile when none exists`         | set with no image         | no `img`; the code and year are rendered                |
| `falls back when the image fails to load`             | fire `error` on the `img` | the typographic tile replaces it                        |
| `latest row shows the four most recent, oldest first` | 10 released sets          | four tiles, ascending `releaseYear`                     |
| `grid is four columns on a wide screen`               | stylesheet                | the ≥1280 px rule declares `repeat(4, minmax(0, 1fr))`  |
| `unreleased sets stay locked`                         | an unreleased set         | dimmed, `aria-disabled`, click does not open the dialog |

## Impl steps

- [ ] 1. Add the failing component tests; run `npx vitest run tests/component/story/shop-set-tiles.test.ts`.
- [ ] 2. Create `src/story/shop/SetTile.svelte` taking `set: ShopSetEntry` and `imageUrl: string | null`, rendering the image or the typographic fallback, with an `onerror` that switches to the fallback; `data-cy` values `story-shop-set-tile-<id>`, `story-shop-set-image-<id>`, `story-shop-set-fallback-<id>`.
- [ ] 3. Create `src/story/shop/data/latest-sets.ts` exporting `latestReleasedSets(sets, count = 4)` returning the newest `count` sets in ascending release order.
- [ ] 4. In `ShopBrowseScreen.svelte`, replace both inline tile markups with `SetTile`, and replace `latestRow` with `latestReleasedSets(sets)`.
- [ ] 5. Resolve each set's image URL from the manifest's `missing` list — bundle the missing list as a small JSON import so the UI knows which sets have art without a network probe.
- [ ] 6. Change `.set-grid` to `grid-template-columns: repeat(2, minmax(0, 1fr))` by default, with a `@media (min-width: 1280px)` rule of `repeat(4, minmax(0, 1fr))` and a `@media (max-width: 640px)` rule of one column; keep the section scrolling vertically.
- [ ] 7. Size tiles to the set-image aspect ratio so four fit a 1280 px row without cropping.
- [ ] 8. Run `npx vitest run tests/component/story tests/unit/story tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/shop/SetTile.svelte` (new), `src/story/shop/data/latest-sets.ts` (new), `src/story/shop/ShopBrowseScreen.svelte`, `tests/component/story/shop-set-tiles.test.ts` (new).
- Behaviour change: the shop is illustrated and its grid is fixed at four columns on desktop.
- Migration/config: contributors must have run `npm run assets:sets` (T31) to see art locally.

## Validation

- [ ] `npx vitest run tests/component/story/shop-set-tiles.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual at 1280×720: four tiles per row, scrolls; latest row shows four, oldest to newest
- [ ] app functional — clicking a tile still opens the set dialog
- [ ] commit msg draft: `feat(shop): illustrated set tiles in a four-column grid`
