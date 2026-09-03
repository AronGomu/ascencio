# T1: Remove favourite feature

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** none  
**Commit outcome:** Decks have one mark only—default—and legacy saves/settings containing favourites still load without restoring favourite behavior.

## Context (self-contained)

Goal: delete favourite flag, controls, storage APIs, ordering rank and story plumbing. Default deck remains. This slice frontloads persisted-data compatibility before UI removal. Out of scope: default-deck behavior and tile redesign (T2). Assumption: orphan IndexedDB favourite key stays unread; no destructive migration.

## Requirements

R1. Remove `favourite`, `showFavourite`, `onfavourite`, favourite-first ordering and all favourite controls from deck-select, deck editor library, free-play setup and story pre-battle.
R2. Remove `DeckRepository.setFavourite/listFavourites`, both repository implementations, editor-store favourite actions/state and shell settings preset favourites.
R3. Old story saves and v3 shell settings with favourite fields load; fields are ignored/dropped. Malformed or valid `freePlayPresetFavouriteIds` must not discard unrelated settings.
R4. Keep `defaultDeckId`, `setDefaultDeck`, default-first ordering intact.
R5. Remove or update favourite-specific tests; replace lost assertions with default-order assertions where still relevant.

## Inputs

I1. Read `src/deck-select/deck-select-contracts.ts`, `DeckTile.svelte`, `DeckSelectScreen.svelte`, `src/decks/deck-repository.ts`, both repository impls, `src/decks/deck-library-order.ts`, `src/deck-editor/deck-editor-store.ts`, `src/story/model/story-state.ts`, `story-reducer.ts`, `src/story/saves/story-save-contracts.ts`, `src/story/decks/story-deck-repository.ts`, `src/shell/settings/shell-settings.ts`, `src/shell/screens/free-play-deck-tiles.ts`.
I2. Read every source/test match from `rg -n 'favourite|favorite|FAVOURITE' src tests` before editing.

## Interface contract (level 5)

P1. `DeckTileModel` no longer has `readonly favourite: boolean`.
P2. `DeckRepository` no longer exports `listFavourites()` or `setFavourite(id, value)`.
P3. `DeckLibraryOrderOptions` becomes `{ readonly defaultDeckId: DeckId | null; readonly sort: DeckLibrarySort }`; rank = default first, then selected sort only.
P4. `StoryState` no longer exposes `favouriteDeckIds`; `StoryCommand` no longer has `deck-set-favourite`.
P5. Save normalization accepts an input object containing `favouriteDeckIds` but returns validated current state without that property. Invalid favourite payload must not invalidate otherwise-valid legacy save.
P6. Existing IndexedDB `FAVOURITE_DECKS_KEY` data remains untouched and unread.
E1. No new runtime errors. Legacy data is tolerated silently.
N1. Exactly one local/story default deck at most; deleting default keeps existing default cleanup behavior.

## TDD

1. **Red** — update tests to expect no favourite API/model/control/order rank; add legacy-save fixture containing favourites that still loads.
2. **Green** — remove favourite code while preserving default flow.
3. **Refactor** — remove only imports/types orphaned by this deletion.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Legacy story save | Valid old save + `favouriteDeckIds` | Save loads; current state omits favourites |
| Legacy shell settings | v3 settings + valid/malformed `freePlayPresetFavouriteIds` | Remaining settings survive; favourite field drops |
| Deck ordering | Default id + modified/name sort | Default first; no favourite rank |
| UI contracts | Deck tile/library/pre-battle render | No favourite button, prop or handler |
| Repository | Type/API tests | No favourite methods; default methods remain |

## Impl steps

- [ ] 1. Inventory all favourite references; classify persistence, model, UI, test.
  - [ ] 1.1 Add failing legacy-save/default-order tests.
  - [ ] 1.2 Add failing UI/API absence assertions.
- [ ] 2. Make save/settings readers lenient; remove favourite fields from current state.
- [ ] 3. Remove repository/store/reducer/settings favourite APIs and storage reads/writes.
- [ ] 4. Remove model mapping, sorting rank, component props/controls and handlers.
- [ ] 5. Remove only favourite-specific tests/imports; preserve default tests.

## Validation

- [ ] `npx vitest run tests/unit/decks/deck-library-order.test.ts tests/unit/story tests/component/deck-editor/deck-favourites.test.ts tests/component/story/pre-battle-deck-picker.test.ts tests/component/deck-select/deck-tile.test.ts`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] Manual: load legacy story save containing favourites; open free-play + story deck screens; no favourite controls, default still marked.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: default deck remains selectable/persisted.
- [ ] Commit msg draft: `refactor(decks): make default the sole deck mark`
