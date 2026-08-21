# T18: Story-state decks + save v3

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T14
**Commit outcome:** A story save carries its own decks alongside its wallet and collection, and older saves migrate forward without losing anything.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is the data foundation for "a collection — and a deck list — belongs to one specific save".
- This slice: state shape, reducer commands and the save-schema migration. No UI, no repository adapter (T19), no ownership rules (T22).
- Out of scope here: the editor (T19/T23), the free-play library (T20), the starter grant (T21), legality (T25).
- Assumptions in force: decks live **inside** `StoryState`, so saving snapshots them and loading rolls them back with the wallet and collection (ADR-033 consistency); deleting a save deletes its decks with it.

## Requirements

- `StoryState` gains `decks: readonly StoryDeck[]` and `defaultDeckId: string | null`.
- `StoryDeck` reuses the deck domain's own record shape so the editor can read it without translation.
- New reducer commands: `deck-create`, `deck-save`, `deck-delete`, `deck-set-default`.
- The save schema version rises to 3, and a v2 save migrates to v3 by adding an empty deck list and a null default.
- A v3 save round-trips through write/read with its decks intact.

## Inputs

- `src/story/model/story-state.ts` — `StoryState` (fields `dp`, `boosters`, `collection`, `shopReturnScreen`, `shopSetId`, `openedCards`, `openingMode`, …) and `createInitialStoryState()`.
- `src/story/model/story-reducer.ts` — the `StoryCommand` union (`new-game`, `buy-packs`, `buy-single`, `open-boosters`, `sell-cards`, `reset`, …) and `reduceStory(state, command)`.
- `src/story/saves/story-save-contracts.ts` — `STORY_SAVE_SCHEMA_VERSION = 2` (line 18), `OLDEST_READABLE_SCHEMA_VERSION = 1` (line 22), the envelope shape (`schemaVersion`, `slot`, `savedAt`, `state`), `StorySlotKey = "manual:1|2|3" | "autosave" | "checkpoint:pre-duel"`, the read result union (`empty | corrupt | incompatible | ok`), and `migrateStorySaveState(state, schemaVersion)`.
- `src/decks/deck-contracts.ts` — `DeckRecord` (`schemaVersion: 1`, `id`, `revision`, `name`, `createdAt`, `updatedAt`, `main`, `extra`, `side`, `validation`, `importedNeedsReview`), `DeckId`, `deckId(value)`.
- `src/story/saves/story-save-repository.ts` — the writer/reader.
- Tests: `tests/unit/story/` (existing story unit tests), `tests/component/story/`.

## From Depends

- T14 widened `AppRoute` in `src/shell/routes.ts` with `story-decks`, `story-deck`, `story-collection`, `free-play`, `free-play-decks`, `free-play-deck`, `free-play-collection`, redirected `#/duel` and `#/decks`, and added every kind to `ROUTE_INDEX` in `src/shell/admin/admin-actions.ts`. ADR-051 records the navigation decision.

## TDD

1. **Red** — add `tests/unit/story/story-decks.test.ts` (reducer cases) and extend the save-contract test with a v2→v3 migration case.
2. **Green** — widen the state, add the four commands, bump the schema and write the migration.
3. **Refactor** — keep every existing command's behaviour byte-identical.

## Test plan

| Test                                                | Input                       | Expect                                                              |
| --------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| `a new save starts with no decks`                   | `createInitialStoryState()` | `decks` is `[]`, `defaultDeckId` is `null`                          |
| `deck-create appends a deck`                        | one `DeckRecord`            | `decks.length === 1`, state is a new object (immutability)          |
| `deck-save replaces by id and bumps nothing else`   | edited record               | the record is replaced; `dp` and `collection` unchanged             |
| `deck-delete removes it and clears a stale default` | delete the default deck     | `decks` empty, `defaultDeckId === null`                             |
| `deck-set-default rejects an unknown id`            | random id                   | state unchanged                                                     |
| `a v2 save migrates to v3 with an empty deck list`  | v2 envelope                 | read result `ok`; `state.decks === []`; every other field preserved |
| `a v3 save round-trips`                             | write then read `manual:1`  | decks and default id identical                                      |
| `an unknown future version is incompatible`         | `schemaVersion: 4`          | read result `incompatible`                                          |

## Impl steps

- [ ] 1. Add the failing tests; run `npx vitest run tests/unit/story`.
- [ ] 2. In `src/story/model/story-state.ts`, add `export interface StoryDeck extends DeckRecord {}` (import the type from `src/decks/deck-contracts.ts` — `src/decks/` is the shared library and is importable) plus `readonly decks: readonly StoryDeck[];` and `readonly defaultDeckId: string | null;`, and initialise both in `createInitialStoryState()`.
- [ ] 3. In `src/story/model/story-reducer.ts`, extend `StoryCommand` with `{ type: "deck-create"; deck: StoryDeck }`, `{ type: "deck-save"; deck: StoryDeck }`, `{ type: "deck-delete"; id: string }`, `{ type: "deck-set-default"; id: string | null }`, and implement each case immutably.
- [ ] 4. In `src/story/saves/story-save-contracts.ts`, raise `STORY_SAVE_SCHEMA_VERSION` to `3`, extend the envelope type, and add the v2→v3 branch to `migrateStorySaveState` (add `decks: []`, `defaultDeckId: null`).
- [ ] 5. Extend the record validator so a v3 record without `decks` is treated as corrupt, while a migrated v2 record is not.
- [ ] 6. Run `npx vitest run tests/unit/story`, then the whole unit suite.
- [ ] 7. Write `docs/ADR/049_ADR_save_owned_decks.md`: context (decks were global while the collection was per-save), decision (decks inside `StoryState`, snapshotted and rolled back with the save; the existing database becomes the free-play library), consequences (loading an old save reverts decks built after it; deleting a save deletes its decks).

## Outputs

- Files touched: `src/story/model/story-state.ts`, `src/story/model/story-reducer.ts`, `src/story/saves/story-save-contracts.ts`, `tests/unit/story/story-decks.test.ts` (new) and the save-contract test, `docs/ADR/049_ADR_save_owned_decks.md` (new).
- Public API change: `StoryState` (exported from `src/story/index.ts`) gains two fields; the save schema is v3.
- Migration: v2 saves migrate on read; no destructive rewrite.

## Validation

- [ ] `npx vitest run tests/unit/story` passes
- [ ] `npm run check:headless` passes
- [ ] manual: load a save made before this change — progress, wallet and collection intact, deck list empty
- [ ] app functional — the story still plays; no screen reads the new fields yet
- [ ] commit msg draft: `feat(story): a save carries its own decks, schema v3 with a v2 migration`
