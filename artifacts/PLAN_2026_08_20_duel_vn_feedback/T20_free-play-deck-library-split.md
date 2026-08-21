# T20: Free-play library split

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T19
**Commit outcome:** The existing deck database is explicitly the free-play library, and every deck already stored there stays there and keeps working.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket completes the split between save-owned decks and free-play decks.
- This slice: naming, selection and a migration note — one factory returns the right repository for a context, and existing decks are declared free-play decks.
- Out of scope here: the editor's context binding (T23), the ownership contract (T22), the starter grant (T21).
- Assumptions in force: decks that existed before this plan belong to free play; no deck data is copied into any save.

## Requirements

- A single entry point returns a `DeckRepository` for a given context: free play → the IndexedDB repository; a story save → the story adapter.
- The free-play repository is the existing `ygo-story-decks` database, unchanged in schema.
- Nothing migrates deck rows anywhere; the split is by which repository a context uses.
- The admin console's storage target list still names the free-play library correctly.

## Inputs

- `src/decks/indexeddb-deck-repository.ts` — the existing repository and its factory.
- `src/decks/deck-database.ts:10-24` — `DECK_DATABASE_NAME = "ygo-story-decks"`, `DECK_DATABASE_VERSION = 2`, `LEGACY_DECK_DATABASE_NAME`, `MAXIMUM_DECK_AUTOSAVES`.
- `src/story/decks/story-deck-repository.ts` — after T19: `createStoryDeckRepository(deps)`.
- `src/shell/admin/admin-actions.ts:20-26` — the `decks` storage target labelled "Deck library".
- `src/deck-editor/deck-editor-store.ts` — where the editor obtains its repository today.
- Tests: `tests/unit/decks/deck-database-migration.test.ts`, `tests/unit/admin-actions.test.ts`.

## From Depends

- T19 added `src/story/decks/story-deck-repository.ts` exporting `createStoryDeckRepository(deps: { readState; dispatch; persist }): DeckRepository`, exported it from `src/story/index.ts`, and widened the frozen export list in `tests/unit/domain-boundaries.test.ts`. T18 before it put `decks` and `defaultDeckId` inside `StoryState` at save schema v3.

## TDD

1. **Red** — add `tests/unit/decks/deck-repository-context.test.ts`: `free play resolves to the IndexedDB library`, `a story context resolves to the save adapter`, `the free-play database name is unchanged`.
2. **Green** — add `resolveDeckRepository(context)`.
3. **Refactor** — rename the admin label to "Free-play deck library" and keep the database name constant untouched.

## Test plan

| Test                                           | Input                   | Expect                                             |
| ---------------------------------------------- | ----------------------- | -------------------------------------------------- |
| `free play resolves to the IndexedDB library`  | `{ kind: "free-play" }` | the returned repository reads `DECK_DATABASE_NAME` |
| `a story context resolves to the save adapter` | `{ kind: "story", … }`  | the returned repository is the story adapter       |
| `the free-play database name is unchanged`     | constant                | `"ygo-story-decks"`                                |
| `existing decks remain listed in free play`    | seeded IDB with 2 decks | `list()` returns both                              |
| `admin still targets the deck database`        | `ADMIN_STORAGE_TARGETS` | one target with `name === DECK_DATABASE_NAME`      |

## Impl steps

- [ ] 1. Add the failing test file; run `npx vitest run tests/unit/decks/deck-repository-context.test.ts`.
- [ ] 2. Create `src/decks/deck-repository-context.ts` exporting `export type DeckContext = { kind: "free-play" } | { kind: "story"; readState(): StoryState; dispatch(c: StoryCommand): void; persist(): Promise<void> };` — declared structurally so `src/decks` does not import the story domain — and `resolveDeckRepository(context, factories): DeckRepository`.
- [ ] 3. Pass the two concrete factories in from the caller (the shell/editor), keeping `src/decks/` free of any story import: the story factory arrives as a parameter.
- [ ] 4. Update `src/deck-editor/deck-editor-store.ts` to obtain its repository through `resolveDeckRepository`, defaulting to free play until T23 supplies the context.
- [ ] 5. Change the admin target label from "Deck library" to "Free-play deck library" in `src/shell/admin/admin-actions.ts`; leave `name` alone.
- [ ] 6. Add a paragraph to `docs/ADR/049_ADR_save_owned_decks.md` recording that pre-existing decks are free-play decks and that nothing is copied into saves.
- [ ] 7. Run `npx vitest run tests/unit/decks tests/unit/admin-actions.test.ts tests/unit/domain-boundaries.test.ts`.

## Outputs

- Files touched: `src/decks/deck-repository-context.ts` (new), `src/deck-editor/deck-editor-store.ts`, `src/shell/admin/admin-actions.ts`, `docs/ADR/049_ADR_save_owned_decks.md`, `tests/unit/decks/deck-repository-context.test.ts` (new).
- Public API change: `src/decks/` exposes a context resolver; the frozen index list is unchanged unless the resolver is exported from `src/decks/index.ts` (if so, update `tests/unit/domain-boundaries.test.ts` deliberately).
- Migration/config: none — no rows move.

## Validation

- [ ] `npx vitest run tests/unit/decks` passes
- [ ] `npx vitest run tests/unit/domain-boundaries.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: open the deck editor from free play — your existing decks are all there
- [ ] app functional — the editor behaves exactly as before in free play
- [ ] commit msg draft: `feat(decks): resolve a deck repository per context, free play keeps the database`
