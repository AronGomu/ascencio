# T22: Card ownership contract

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T18
**Commit outcome:** One typed function answers "how many copies of this card may this context use", returning the save's owned count in a story and unlimited in free play.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is the single source of truth the catalog, deck validation, the sell screen and the collection screen all read.
- This slice: the contract plus its two implementations. No screen consumes it yet.
- Out of scope here: catalog filtering (T24), legality (T25), the sell dialog (T26), the collection screen (T29).
- Assumptions in force: free play owns everything at maximum copies through a **flag**, never a materialised record; ownership governs availability only — the pinned ruleset's per-card deck limit still applies to validation.

## Requirements

- `CardOwnership` exposes `ownedCount(code: number): number` and `isUnlimited: boolean`.
- A story context returns `collection[code] ?? 0`.
- A free-play context returns `Number.POSITIVE_INFINITY` (or a documented sentinel) with `isUnlimited: true`.
- The contract is exported from `src/story/index.ts` for the story side and lives where the deck editor can import it without reaching into the story's internals.
- Reading ownership never mutates state and never touches storage.

## Inputs

- `src/story/model/story-state.ts` — `collection: Readonly<Record<number, number>>`, plus (after T18) `decks` and `defaultDeckId`.
- `src/story/index.ts` — the story domain's public entry; after T19 it also exports `createStoryDeckRepository`.
- `tests/unit/domain-boundaries.test.ts` — freezes the exported names of every public entry; widening it is a deliberate edit.
- `src/decks/catalog/pinned-ruleset.ts` — the per-card copy limit used by validation, which this contract must **not** replace.
- `src/decks/deck-validation.ts` — `validateDeckDraft`, the consumer T25 will extend.
- Tests: `tests/unit/story/`, `tests/unit/decks/`.

## From Depends

- T18 added `decks: readonly StoryDeck[]` and `defaultDeckId: string | null` to `StoryState`, four deck reducer commands, and save schema v3 with a v2→v3 migration. The `collection` field it reads was already present (ADR-033).

## TDD

1. **Red** — add `tests/unit/story/card-ownership.test.ts` with the cases below.
2. **Green** — implement `src/story/decks/card-ownership.ts` and the free-play counterpart.
3. **Refactor** — none; keep both implementations tiny and total.

## Test plan

| Test                                              | Input                     | Expect                                                      |
| ------------------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| `story ownership reports the collection count`    | `collection: { 4007: 2 }` | `ownedCount(4007) === 2`                                    |
| `story ownership reports zero for a missing card` | empty collection          | `ownedCount(1) === 0`                                       |
| `story ownership is not unlimited`                | any story state           | `isUnlimited === false`                                     |
| `free play owns everything`                       | free-play ownership       | `ownedCount(anything) === Infinity`, `isUnlimited === true` |
| `ownership never mutates the state`               | call `ownedCount` 3 times | the state object is referentially unchanged                 |
| `ownership does not encode deck copy limits`      | `collection: { 4007: 9 }` | `ownedCount === 9` (the ruleset limits the deck, not this)  |

## Impl steps

- [ ] 1. Add the failing test file; run `npx vitest run tests/unit/story/card-ownership.test.ts`.
- [ ] 2. Create `src/story/decks/card-ownership.ts` exporting `export interface CardOwnership { ownedCount(code: number): number; readonly isUnlimited: boolean; }`, `storyCardOwnership(state: StoryState): CardOwnership` and `unlimitedCardOwnership(): CardOwnership`.
- [ ] 3. Document in a comment why free play uses a flag rather than a materialised record (storage cost, and it would need re-materialising whenever the catalog grows).
- [ ] 4. Export `CardOwnership`, `storyCardOwnership` and `unlimitedCardOwnership` from `src/story/index.ts`.
- [ ] 5. Add those three names to the frozen list for `src/story/index.ts` in `tests/unit/domain-boundaries.test.ts`.
- [ ] 6. Run `npx vitest run tests/unit/story tests/unit/domain-boundaries.test.ts`.
- [ ] 7. Write `docs/ADR/050_ADR_card_ownership_invariant.md`: context (a story economy that owns cards makes decks depend on a resource), decision (one `CardOwnership` contract; story reads the save's collection; free play answers unlimited through a flag; every card in a story deck must be owned), consequences (catalog filtering, a legality rule, and a sell-time warning all read the same function).

## Outputs

- Files touched: `src/story/decks/card-ownership.ts` (new), `src/story/index.ts`, `tests/unit/story/card-ownership.test.ts` (new), `tests/unit/domain-boundaries.test.ts`, `docs/ADR/050_ADR_card_ownership_invariant.md` (new).
- Public API change: `src/story/index.ts` exports the ownership contract and its two constructors.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/unit/story/card-ownership.test.ts` passes
- [ ] `npx vitest run tests/unit/domain-boundaries.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] app functional — nothing consumes the contract yet, so no screen changes
- [ ] commit msg draft: `feat(story): one ownership contract for the story collection and free play`
