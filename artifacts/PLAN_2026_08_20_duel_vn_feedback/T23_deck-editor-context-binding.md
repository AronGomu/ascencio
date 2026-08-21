# T23: Editor context binding

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T20, T22
**Commit outcome:** The deck editor knows whether it is editing a story save or the free-play library, uses the matching repository and ownership, and says which one on screen.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket connects the two deck worlds to the one editor.
- This slice: context plumbing plus a banner. The catalog still shows every card here; T24 restricts it.
- Out of scope here: owned-only filtering (T24), legality (T25), the collection screen (T29/T30).
- Assumptions in force: the editor shows a context banner naming the save or Free Play; the story context is only available while a save is loaded; a story deck route reached with no save loaded returns to the main menu.

## Requirements

- `#/free-play/decks(/:id)` binds the free-play repository and unlimited ownership.
- `#/story/decks(/:id)` binds the story adapter and the save's ownership.
- The editor renders a banner naming the context.
- A story deck route with no loaded save navigates to `#/` instead of rendering an empty editor.
- The editor's own components receive the context through one prop/store, not through global lookups.

## Inputs

- `src/deck-editor/deck-editor-store.ts` — after T20 it resolves its repository through `resolveDeckRepository`, defaulting to free play.
- `src/decks/deck-repository-context.ts` — after T20: `DeckContext = { kind: "free-play" } | { kind: "story"; readState; dispatch; persist }` and `resolveDeckRepository(context, factories)`.
- `src/story/index.ts` — after T19/T22: `createStoryDeckRepository`, `CardOwnership`, `storyCardOwnership`, `unlimitedCardOwnership`.
- `src/deck-editor/index.ts` — the domain's public entry, whose exported names are frozen in `tests/unit/domain-boundaries.test.ts`.
- `src/shell/AppShell.svelte` — mounts the deck editor for the four deck routes added in T14.
- `src/deck-editor/DeckEditorApp.svelte`, `src/deck-editor/components/DeckLibrary.svelte` — the surfaces that show the deck list and need the banner.
- Tests: `tests/component/deck-editor/`, `tests/unit/domain-boundaries.test.ts`, `tests/component/AppShell.test.ts`.

## From Depends

- T20 added `src/decks/deck-repository-context.ts` with the structural `DeckContext` type and `resolveDeckRepository(context, factories)`, pointed `deck-editor-store.ts` at it with a free-play default, and relabelled the admin storage target "Free-play deck library".
- T22 added `src/story/decks/card-ownership.ts` with `CardOwnership { ownedCount(code): number; isUnlimited: boolean }`, `storyCardOwnership(state)` and `unlimitedCardOwnership()`, all exported from `src/story/index.ts` and listed in the boundary test. ADR-050 records the invariant.

## TDD

1. **Red** — add `tests/component/deck-editor/editor-context.test.ts`: `free-play route uses the free-play repository`, `story route uses the save adapter`, `banner names the context`, `story route without a save returns to the main menu`.
2. **Green** — add a context prop to the editor entry and thread it through the store.
3. **Refactor** — keep the editor's internal components ignorant of _how_ the context was resolved.

## Test plan

| Test                                                  | Input                                       | Expect                                                                     |
| ----------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| `free-play route uses the free-play repository`       | mount at `#/free-play/decks`                | the IndexedDB repository factory was called; ownership `isUnlimited`       |
| `story route uses the save adapter`                   | mount at `#/story/decks` with a loaded save | the story adapter factory was called; ownership reads the collection       |
| `banner names the context`                            | both routes                                 | `[data-cy="deck-editor-context-banner"]` reads `Free Play` / the save name |
| `story route without a save returns to the main menu` | mount at `#/story/decks`, no save           | `navigate({ kind: "home" })`; editor not mounted                           |
| `deck list shows the context's decks`                 | 2 free-play decks, 1 save deck              | the free-play route lists 2, the story route lists 1                       |

## Impl steps

- [ ] 1. Add the failing component tests; run `npx vitest run tests/component/deck-editor/editor-context.test.ts`.
- [ ] 2. Add `export let context: DeckEditorContext;` to `src/deck-editor/DeckEditorApp.svelte`, where `DeckEditorContext = { kind: "free-play" } | { kind: "story"; saveLabel: string; repository: DeckRepository; ownership: CardOwnership }`; declare the type in `src/deck-editor/deck-editor-context.ts`.
- [ ] 3. Thread the context into `deck-editor-store.ts` so the store no longer resolves a repository itself.
- [ ] 4. In `src/shell/AppShell.svelte`, build the context per route: free play → `{ kind: "free-play" }` with the IndexedDB repository and `unlimitedCardOwnership()`; story → the story adapter over the loaded save plus `storyCardOwnership(state)`.
- [ ] 5. Guard the story deck routes: when no save is loaded, `navigate({ kind: "home" })` before mounting.
- [ ] 6. Render the banner in `DeckEditorApp.svelte` at `data-cy="deck-editor-context-banner"`.
- [ ] 7. Export `DeckEditorContext` from `src/deck-editor/index.ts` and add it to the frozen list in `tests/unit/domain-boundaries.test.ts`.
- [ ] 8. Run `npx vitest run tests/component/deck-editor tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/deck-editor/deck-editor-context.ts` (new), `src/deck-editor/DeckEditorApp.svelte`, `src/deck-editor/deck-editor-store.ts`, `src/deck-editor/index.ts`, `src/shell/AppShell.svelte`, `tests/component/deck-editor/editor-context.test.ts` (new), `tests/unit/domain-boundaries.test.ts`.
- Public API change: `src/deck-editor/index.ts` exports `DeckEditorContext`.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/deck-editor` passes
- [ ] `npx vitest run tests/unit/domain-boundaries.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: open the editor from free play and from inside a story — each lists its own decks and names itself
- [ ] app functional — free-play editing is unchanged
- [ ] commit msg draft: `feat(deck-editor): bind the editor to a deck context and name it on screen`
