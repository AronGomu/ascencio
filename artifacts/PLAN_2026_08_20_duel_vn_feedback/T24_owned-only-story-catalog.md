# T24: Owned-only story catalog

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T23
**Commit outcome:** Inside a story save the deck-editor catalog offers only the cards that save owns, and never lets you add a copy you do not have.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is the story half of the ownership gate.
- This slice: the catalog list and the add path. The collection screen (T29) carries the "show every existing card" checkbox; the catalog does not.
- Out of scope here: legality of an already-saved deck (T25), the sell dialog (T26), free play (unchanged — its ownership is unlimited).
- Assumptions in force: catalog entries are strictly the owned ones in a story context; adding is capped by both the owned count and the pinned ruleset's copy limit, whichever is smaller.

## Requirements

- In a story context the catalog lists only codes with `ownedCount(code) > 0`.
- The number of copies addable to a deck is `min(ownedCount(code), rulesetLimit(code))`, counted across main + extra + side.
- Reaching the cap disables the add affordance for that card with a reason.
- In free play (unlimited ownership) the catalog and the caps behave exactly as they do today.
- The catalog's search and filters keep working on the filtered list.

## Inputs

- `src/deck-editor/components/CardCatalog.svelte` — the catalog list and its add interactions.
- `src/deck-editor/deck-editor-store.ts` — after T23 it receives the context (repository + ownership) rather than resolving one.
- `src/deck-editor/deck-editor-context.ts` — after T23: `DeckEditorContext = { kind: "free-play" } | { kind: "story"; saveLabel; repository; ownership }`.
- `src/story/decks/card-ownership.ts` — after T22: `CardOwnership { ownedCount(code): number; isUnlimited: boolean }`.
- `src/decks/catalog/active-catalog.ts` — `activeCatalog(): readonly DeckBuilderCardView[]`, the full card list.
- `src/decks/catalog/pinned-ruleset.ts` — the per-card copy limit.
- `src/decks/deck-model.ts` — `applyDeckCommand`, where an add is applied.
- Tests: `tests/component/deck-editor/`, `tests/unit/decks/`.

## From Depends

- T23 added `src/deck-editor/deck-editor-context.ts`, gave `DeckEditorApp.svelte` a `context` prop, threaded it into `deck-editor-store.ts`, built the context per route in `src/shell/AppShell.svelte` (free play → IndexedDB repository + `unlimitedCardOwnership()`; story → `createStoryDeckRepository` + `storyCardOwnership(state)`), rendered `[data-cy="deck-editor-context-banner"]`, and exported `DeckEditorContext` from `src/deck-editor/index.ts`.

## TDD

1. **Red** — add `tests/component/deck-editor/owned-only-catalog.test.ts` with the cases below.
2. **Green** — filter the catalog by ownership and cap the add path.
3. **Refactor** — put the cap calculation in one exported pure function so T25 can reuse it.

## Test plan

| Test                                    | Input                                      | Expect                                        |
| --------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| `story catalog lists only owned cards`  | collection `{4007: 1}`, catalog of 5 cards | one catalog row, for `4007`                   |
| `free play lists the whole catalog`     | unlimited ownership                        | five rows                                     |
| `adding is capped by the owned count`   | own 1 copy, add twice                      | second add refused; deck holds 1              |
| `adding is capped by the ruleset limit` | own 5 copies of a card limited to 3        | fourth add refused                            |
| `the cap counts across zones`           | 1 copy in main, try to add to side         | refused                                       |
| `a capped card explains why`            | capped card row                            | disabled affordance with an accessible reason |
| `search still filters the owned list`   | search text                                | results are a subset of owned cards           |

## Impl steps

- [ ] 1. Add the failing component tests; run `npx vitest run tests/component/deck-editor/owned-only-catalog.test.ts`.
- [ ] 2. Create `src/deck-editor/catalog-availability.ts` exporting `availableCopies(code: number, ownership: CardOwnership, rulesetLimit: number, usedCopies: number): number`.
- [ ] 3. In `deck-editor-store.ts`, derive the catalog list from `activeCatalog()` filtered by `ownership.isUnlimited || ownership.ownedCount(code) > 0`.
- [ ] 4. In `CardCatalog.svelte`, disable the add affordance when `availableCopies(...) === 0` and render the reason at `data-cy={`deck-catalog-cap-reason-${code}`}`.
- [ ] 5. Guard the add command itself in the store so a keyboard or drag path cannot bypass the cap.
- [ ] 6. Leave free play untouched by making every check trivially true when `ownership.isUnlimited`.
- [ ] 7. Run `npx vitest run tests/component/deck-editor tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/deck-editor/catalog-availability.ts` (new), `src/deck-editor/deck-editor-store.ts`, `src/deck-editor/components/CardCatalog.svelte`, `tests/component/deck-editor/owned-only-catalog.test.ts` (new).
- Behaviour change: story deck building is restricted to owned cards.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/deck-editor` passes
- [ ] `npm run check:headless` passes
- [ ] manual: in a story save the catalog shows only your cards; in free play it shows everything
- [ ] app functional — free-play deck building is unchanged
- [ ] commit msg draft: `feat(deck-editor): a story save builds only from the cards it owns`
