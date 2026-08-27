# T13: Story save favourites

**Plan:** `./artifacts/PLAN_2026_08_27_deck_selection_screen.md`
**Depends:** T1
**Commit outcome:** A story save carries `favouriteDeckIds`; the reducer can toggle one; old saves load with an empty list. Pure model/save work — the pre-battle UI consumes it in T14.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §The deck tile favourite star, §List ordering rank 3) for the story scope — story decks belong to the save (ADR-049), so their favourites must too; the shared screen's star needs a place to write.
- This slice: story domain model + save schema only. No UI, no shared-lib import.
- Out of scope here: PreBattleScreen swap (T14), free-play favourites (already exist via `DeckRepository.listFavourites`), story deck default (exists: `StoryState.defaultDeckId` + `deck-set-default` command).
- Assumptions in force: story save validation is shape-checking in `src/story/saves/story-save-contracts.ts` (`defaultDeckId` checked as id-not-pointer precedent ~line 400); reducer commands are the only mutation path (deck commands ~line 78, ADR pattern "deck-*").

## Requirements

- `src/story/model/story-state.ts`:
  - `StoryState` gains `readonly favouriteDeckIds: readonly string[];` beside `defaultDeckId` (~line 99), initial value `[]` in the initial-state literal (~line 140).
- `src/story/model/story-reducer.ts`:
  - New command in the deck group (~line 78): `| { readonly type: "deck-set-favourite"; readonly id: string; readonly favourite: boolean }`.
  - Case: `favourite: true` adds id if absent; `false` removes. Unknown deck id → add anyway is wrong (dangling favourite) — follow `deck-save`'s guard precedent (~line 359): unknown id returns `state` unchanged. `deck-delete` case additionally prunes the deleted id from `favouriteDeckIds` (no dangling favourites after delete).
- `src/story/saves/story-save-contracts.ts`:
  - Persist `favouriteDeckIds` with the save; loading a save without the field → `[]` (same tolerance style the file uses for older shapes — read its migration/defaulting precedent around the `defaultDeckId` check ~line 400-408 and mirror it: ids checked as strings, not pointers; non-array/garbage → reject like sibling fields are rejected, absent → default).
- No pruning-on-load beyond validation: a favourite naming a gone deck is dropped by the `deck-delete` prune going forward; loaded legacy dangles are filtered at read into state (decide: filter against `state.decks` when hydrating, same place `defaultDeckId` dangling is tolerated — match whatever that code does; if it keeps dangling defaults, keep dangling favourites and let the UI ignore unknown ids).

## Inputs

- `src/story/model/story-state.ts` — `StoryState.decks` (`StoryDeck[]`), `defaultDeckId` (~lines 96-99, 139-140).
- `src/story/model/story-reducer.ts` — deck command union (~78), `deck-create/save/delete/set-default` cases (~353+), guard precedents.
- `src/story/saves/story-save-contracts.ts` — save shape validation, `defaultDeckId` handling (~400-408), starter-grant path (~211-218).
- Existing tests: `git grep -ln "deck-set-default\|deck-delete" tests/` — extend those files.
- **From Depends:** T1 ordering only (branch base); no code dependency.

## TDD

1. **Red** — reducer + save round-trip tests; fail.
2. **Green** — implement.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `favourite toggles on and off` | state with deck d1; set-favourite d1 true, then false | list [d1] then [] |
| `favourite of unknown deck is refused` | set-favourite "ghost" true | state unchanged |
| `favourite is idempotent` | set-favourite d1 true twice | list [d1] once |
| `deleting a deck prunes its favourite` | favourite d1, deck-delete d1 | favouriteDeckIds [] |
| `save round-trips favourites` | serialize state with [d1], load | [d1] restored |
| `old save without the field loads empty` | stored payload lacking `favouriteDeckIds` | loads, [] |
| `garbage field is rejected` | `favouriteDeckIds: "x"` | save rejected like sibling shape violations |

Run: `npx vitest run tests/unit/story` (match the actual dir of existing reducer/save tests — `git grep -ln "story-reducer" tests/`)

## Impl steps

- [ ] 1. Locate reducer + save-contract test files; write the 7 failing tests.
- [ ] 2. Add field to `StoryState` + initial state.
- [ ] 3. Add `deck-set-favourite` command + case; extend `deck-delete` case with prune.
- [ ] 4. Persist/validate/default in `story-save-contracts.ts` per its own precedent.
- [ ] 5. `npx vitest run tests/unit` → green (watch for save-shape snapshot tests needing the new field).
- [ ] 6. `npm run lint && npm run typecheck && npm run build` → green.

## Outputs

- Edited: `src/story/model/story-state.ts`, `src/story/model/story-reducer.ts`, `src/story/saves/story-save-contracts.ts`, story test files.
- Public API: reducer command `{ type: "deck-set-favourite", id, favourite }`; `StoryState.favouriteDeckIds` — T14 quotes both verbatim.

## Validation

- [ ] `npx vitest run tests/unit` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] app functional — story loads old saves unchanged
- [ ] commit msg draft: `feat(story): let a save remember favourite decks`
