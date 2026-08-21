# T30: Collection entry points

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T29
**Commit outcome:** Both deck menus — free play and story — carry a Collection button that opens the collection for that context.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket makes the new collection screen reachable, which is how `feedback-vn.md` asked for it: "In the deck builder main menu, you have an option to consult your collection."
- This slice: navigation only.
- Out of scope here: the screen itself (T29), filters, the in-story top bar's existing decks button beyond wiring it.
- Assumptions in force: the deck menu is the same screen in both contexts, so the button is added once and routes by context.

## Requirements

- The deck library screen shows a Collection button.
- In a free-play context it navigates to `#/free-play/collection`; in a story context to `#/story/collection`.
- The story's top-bar decks button (currently unwired) navigates to `#/story/decks`.
- The collection screen's Back returns to the deck menu it was opened from.

## Inputs

- `src/deck-editor/components/DeckLibrary.svelte` — the deck menu's toolbar row (one row since commit `9059506`).
- `src/deck-editor/deck-editor-context.ts` — after T23: `DeckEditorContext = { kind: "free-play" } | { kind: "story"; saveLabel; repository; ownership }`.
- `src/story/components/StoryTopBar.svelte` — has `ondecks: () => void` (line 7) with a default hash navigation; `StoryApp.svelte:639-653` passes `onshop` but not `ondecks`.
- `src/shell/routes.ts` — after T14: `story-collection`, `free-play-collection`, `story-decks`, `free-play-decks`.
- `src/story/collection/CollectionScreen.svelte` — after T29: prop `onback`, `data-cy="collection-back"`.
- Tests: `tests/component/deck-editor/`, `tests/component/story/`.

## From Depends

- T29 added `src/story/collection/CollectionScreen.svelte` (`data-cy` `collection-screen`, `collection-show-all`, `collection-group-toggle`, `collection-card-<code>`, `collection-count-<code>`, `collection-back`) and `src/story/collection/group-by-rarity.ts` (`groupByRarity`, `RARITY_ORDER`), mounted at `#/story/collection` and `#/free-play/collection` in `AppShell.svelte`, with ownership built from the save or `unlimitedCardOwnership()`.

## TDD

1. **Red** — add `collection button routes by context` to `tests/component/deck-editor/editor-context.test.ts` and `top bar decks button opens the story decks` to a story component test.
2. **Green** — add the button and wire the top bar.
3. **Refactor** — none.

## Test plan

| Test                                               | Input                        | Expect                                        |
| -------------------------------------------------- | ---------------------------- | --------------------------------------------- |
| `deck menu shows a collection button`              | mount the library            | `[data-cy="deck-library-collection"]` present |
| `free-play context routes to free-play collection` | click it in free play        | `navigate({ kind: "free-play-collection" })`  |
| `story context routes to the story collection`     | click it in a story save     | `navigate({ kind: "story-collection" })`      |
| `top bar decks button opens the story decks`       | click the top bar decks icon | `navigate({ kind: "story-decks" })`           |
| `collection back returns to the deck menu`         | press Back on the collection | `navigate` to the matching decks route        |

## Impl steps

- [ ] 1. Add the failing tests; run `npx vitest run tests/component/deck-editor tests/component/story`.
- [ ] 2. Add a Collection button to `DeckLibrary.svelte`'s toolbar at `data-cy="deck-library-collection"`.
- [ ] 3. Route it from the editor context: `context.kind === "story" ? { kind: "story-collection" } : { kind: "free-play-collection" }`.
- [ ] 4. In `StoryApp.svelte`, pass `ondecks={() => navigate({ kind: "story-decks" })}` to `StoryTopBar` (line ~639) instead of leaving the default.
- [ ] 5. Give `CollectionScreen`'s `onback` the matching decks route in `AppShell.svelte`.
- [ ] 6. Run `npx vitest run tests/component tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/deck-editor/components/DeckLibrary.svelte`, `src/story/StoryApp.svelte`, `src/shell/AppShell.svelte`, `tests/component/deck-editor/editor-context.test.ts`, a story component test.
- Behaviour change: the collection is reachable from both deck menus, and the story's decks icon works.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component` passes
- [ ] `npm run check:headless` passes
- [ ] manual: from free play and from a story save, the deck menu's Collection button opens the right collection and Back returns
- [ ] app functional — deck editing is unchanged
- [ ] commit msg draft: `feat(collection): open the collection from either deck menu`
