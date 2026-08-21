# T19: Story deck repository

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T18
**Commit outcome:** The deck editor can list, load, create, save and delete a story save's decks through the same `DeckRepository` interface it already uses.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket makes save-owned decks usable by the existing editor without forking it.
- This slice: an adapter implementing `DeckRepository` over `StoryState` + the story's reducer/save repository. No UI wiring (T23), no ownership rules (T22/T24).
- Out of scope here: the free-play library (T20), the starter grant (T21), autosave-log semantics beyond what the interface requires.
- Assumptions in force: decks live inside the save (T18); the editor's autosave/history log is kept in memory for a story session rather than persisted per save — the save's decks are the durable artefact.

## Requirements

- `createStoryDeckRepository(...)` returns an object satisfying `DeckRepository` exactly.
- Every mutating call dispatches the matching story command and persists through the story's save path, so a deck edit is part of the save.
- `getDefaultDeck` / `setDefaultDeck` read and write `StoryState.defaultDeckId`.
- Optimistic concurrency is honoured: `save(expectedRevision, …)` rejects when the stored revision differs, exactly as the IndexedDB implementation does.
- `appendAutosave` / `listAutosaves` work in-memory for the session and never grow the save.

## Inputs

- `src/decks/deck-repository.ts` — the interface to satisfy, verbatim:
  ```ts
  export interface DeckRepository {
    list(): Promise<readonly DeckRecord[]>;
    load(id: DeckId): Promise<StoredDeck | null>;
    create(deck: DeckRecord, history: DeckHistory): Promise<StoredDeck>;
    createAndOpen(deck: DeckRecord, history: DeckHistory): Promise<StoredDeck>;
    save(
      expectedRevision: number,
      deck: DeckRecord,
      history: DeckHistory,
    ): Promise<StoredDeck>;
    delete(id: DeckId, expectedRevision: number): Promise<void>;
    getLastOpened(): Promise<DeckId | null>;
    setLastOpened(id: DeckId): Promise<void>;
    clearLastOpened(expectedId?: DeckId): Promise<void>;
    getDefaultDeck(): Promise<DeckId | null>;
    setDefaultDeck(id: DeckId | null): Promise<void>;
    appendAutosave(record: DeckAutosaveRecord): Promise<void>;
    listAutosaves(): Promise<readonly DeckAutosaveRecord[]>;
  }
  ```
- `src/decks/indexeddb-deck-repository.ts` — the reference implementation, including its revision-conflict error type and `StoredDeck` shape.
- `src/decks/deck-contracts.ts` — `DeckRecord`, `DeckId`, `deckId()`, `StoredDeck`, `DeckHistory`, `DeckAutosaveRecord`.
- `src/story/model/story-state.ts` — after T18: `decks: readonly StoryDeck[]`, `defaultDeckId: string | null`.
- `src/story/model/story-reducer.ts` — after T18: commands `deck-create`, `deck-save`, `deck-delete`, `deck-set-default`.
- `src/story/saves/story-save-repository.ts` — `createStorySaveRepository`, `StorySaveRepository`.
- Tests: `tests/unit/decks/` (repository tests live here), `tests/unit/story/`.

## From Depends

- T18 added to `StoryState` the fields `decks: readonly StoryDeck[]` (where `StoryDeck extends DeckRecord`) and `defaultDeckId: string | null`, added the four reducer commands above, raised `STORY_SAVE_SCHEMA_VERSION` to `3` in `src/story/saves/story-save-contracts.ts` with a v2→v3 migration adding an empty deck list, and recorded the decision in `docs/ADR/049_ADR_save_owned_decks.md`.

## TDD

1. **Red** — add `tests/unit/story/story-deck-repository.test.ts` driving the adapter through the whole interface against an in-memory state holder.
2. **Green** — implement `src/story/decks/story-deck-repository.ts`.
3. **Refactor** — share the revision-conflict error with the IndexedDB implementation by importing it rather than redefining it.

## Test plan

| Test                                        | Input                                    | Expect                                                            |
| ------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `list returns the save's decks`             | state with 2 decks                       | both records, in state order                                      |
| `create adds a deck and returns it stored`  | new record                               | `list()` has 3; returned `StoredDeck.revision === 1`              |
| `save rejects a stale revision`             | `expectedRevision` behind the stored one | rejects with the same error type the IDB repository throws        |
| `save persists through the story save path` | successful save                          | the save repository's write was called once                       |
| `delete removes the deck`                   | existing id                              | `list()` shrinks; `load()` returns `null`                         |
| `delete clears a stale default`             | delete the default deck                  | `getDefaultDeck()` resolves `null`                                |
| `default deck round-trips`                  | `setDefaultDeck(id)`                     | `getDefaultDeck()` resolves that id                               |
| `autosaves stay in memory`                  | append 3 records                         | `listAutosaves()` returns 3; the persisted state has no autosaves |
| `lastOpened round-trips within the session` | set then get                             | same id; not written into the save                                |

## Impl steps

- [ ] 1. Add the failing test file; run `npx vitest run tests/unit/story/story-deck-repository.test.ts`.
- [ ] 2. Create `src/story/decks/story-deck-repository.ts` exporting `createStoryDeckRepository(deps: { readState(): StoryState; dispatch(command: StoryCommand): void; persist(): Promise<void> }): DeckRepository`.
- [ ] 3. Implement the read methods straight off `readState()`.
- [ ] 4. Implement `create`/`createAndOpen`/`save`/`delete` by dispatching the T18 commands, then `await persist()`; return the `StoredDeck` shape the editor expects.
- [ ] 5. Reuse the revision-conflict error exported by `src/decks/indexeddb-deck-repository.ts`; throw it on a mismatch before dispatching.
- [ ] 6. Keep `lastOpened` and the autosave log in module-local session state; document in a comment why they are not persisted (they describe an editing session, not the save).
- [ ] 7. Export `createStoryDeckRepository` from `src/story/index.ts` and add its name to the frozen export list in `tests/unit/domain-boundaries.test.ts` — widening a public API is a deliberate edit there.
- [ ] 8. Run `npx vitest run tests/unit/story tests/unit/domain-boundaries.test.ts`.

## Outputs

- Files touched: `src/story/decks/story-deck-repository.ts` (new), `src/story/index.ts`, `tests/unit/story/story-deck-repository.test.ts` (new), `tests/unit/domain-boundaries.test.ts`.
- Public API change: `src/story/index.ts` exports `createStoryDeckRepository`.
- Migration/config: none beyond T18's schema bump.

## Validation

- [ ] `npx vitest run tests/unit/story/story-deck-repository.test.ts` passes
- [ ] `npx vitest run tests/unit/domain-boundaries.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] app functional — nothing mounts the adapter yet, so no screen changes
- [ ] commit msg draft: `feat(story): a deck repository backed by the save's own deck list`
