# T21: New-save starter grant

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T19
**Commit outcome:** Starting a new story gives you the starter deck **and** the cards it is built from, so the deck is legal under the ownership rule from the first duel.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket makes a fresh save playable under save-owned decks.
- This slice: the grant at `new-game` time — one deck plus the matching collection entries, with the wallet unchanged at 1000 DP.
- Out of scope here: the ownership check itself (T22/T25), the editor (T23/T24), the pre-battle picker (T27).
- Assumptions in force: the starter deck is the existing `src/battle/duel/presets/decks/player.ydk`; every copy in that list is credited to the collection at the count the deck uses; starting DP stays 1000 (a pack costs 150).

## Requirements

- `new-game` produces a state whose `decks` holds exactly one deck named `Starter Deck`, whose `defaultDeckId` points at it, and whose `collection` contains at least the copies that deck uses.
- Granted cards carry a rarity for the sell ladder — use `common` for starter cards.
- The grant is deterministic: two new games produce identical decks and collections.
- Re-entering `new-game` on an existing save replaces the state wholesale, as it does today.

## Inputs

- `src/decks/starter-deck.ts` — `STARTER_DECK_NAME = "Starter Deck"`, `ensureStarterDeck(repository, catalog, ruleset, source = starterYdk)`, importing `../battle/duel/presets/decks/player.ydk?raw`. Its comment records that this module is intentionally not exported from `src/decks/index.ts`; import the path directly, which ADR-022 allows for the shared deck library.
- `src/decks/ydk-adapter.ts` — `importYdk(source)`; `src/decks/deck-model.ts` — `createBlankDeck`, `applyDeckCommand`; `src/decks/deck-validation.ts` — `validateDeckDraft`.
- `src/story/model/story-reducer.ts` — the `new-game` case and (after T18) `deck-create` / `deck-set-default`.
- `src/story/model/story-state.ts` — `createInitialStoryState()` with `dp: 1000`, `collection: {}`, and (after T18) `decks: []`, `defaultDeckId: null`.
- `src/story/shop/data/shop-rarity.ts` — the `ShopRarity` union used by the collection and the sell ladder.
- `src/decks/catalog/active-catalog.ts` — `activeCatalog()` for card validation data.
- Tests: `tests/unit/story/`, `tests/unit/decks/`.

## From Depends

- T19 added `createStoryDeckRepository(deps)` in `src/story/decks/story-deck-repository.ts`, exported from `src/story/index.ts`. T18 added `decks`, `defaultDeckId`, the four deck commands and save schema v3.

## TDD

1. **Red** — add `tests/unit/story/new-game-grant.test.ts`: `a new game grants the starter deck`, `a new game credits the starter deck's cards`, `the granted deck is the default`, `the grant is deterministic`.
2. **Green** — build the grant helper and call it from the `new-game` reducer case.
3. **Refactor** — keep `ensureStarterDeck` untouched for free play; the story grant is its own function so the two contexts never share mutable state.

## Test plan

| Test                                           | Input                | Expect                                                             |
| ---------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| `a new game grants the starter deck`           | `new-game`           | `decks.length === 1`, name `"Starter Deck"`, main deck ≥ 40 cards  |
| `a new game credits the starter deck's cards`  | `new-game`           | for every code in the deck, `collection[code] >= usedCopies(code)` |
| `the granted deck is the default`              | `new-game`           | `defaultDeckId === decks[0].id`                                    |
| `the wallet is unchanged`                      | `new-game`           | `dp === 1000`                                                      |
| `the grant is deterministic`                   | two `new-game` calls | deck card lists and collection maps are deeply equal               |
| `granted cards are common for the sell ladder` | `new-game`           | every granted entry's rarity is `common`                           |

## Impl steps

- [ ] 1. Add the failing test file; run `npx vitest run tests/unit/story/new-game-grant.test.ts`.
- [ ] 2. Create `src/story/decks/starter-grant.ts` exporting `buildStarterGrant(catalog): { deck: StoryDeck; collection: Record<number, number> }`.
- [ ] 3. Parse `player.ydk` with `importYdk`, build the record through `createBlankDeck` + `applyDeckCommand`, and validate it with `validateDeckDraft` so the stored `validation` summary is real.
- [ ] 4. Use a fixed id and fixed `createdAt`/`updatedAt` strings so the grant is deterministic and diffable in tests.
- [ ] 5. Count copies per code across main/extra/side and write them into the collection map.
- [ ] 6. In `story-reducer.ts`, call the grant inside the `new-game` case, setting `decks`, `defaultDeckId` and merging the collection.
- [ ] 7. Record the rarity choice (`common` for granted starter cards) in a comment beside the grant.
- [ ] 8. Run `npx vitest run tests/unit/story tests/unit/decks`.

## Outputs

- Files touched: `src/story/decks/starter-grant.ts` (new), `src/story/model/story-reducer.ts`, `tests/unit/story/new-game-grant.test.ts` (new).
- Behaviour change: a new story save is immediately able to duel with a deck it owns.
- Migration/config: none — existing saves are untouched (they migrate to v3 with an empty deck list; T27 tells the player to build or pick one).

## Validation

- [ ] `npx vitest run tests/unit/story/new-game-grant.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: New Game, open the deck list — the starter deck is there and marked default; the collection lists its cards
- [ ] app functional — existing saves still load
- [ ] commit msg draft: `feat(story): a new save is granted the starter deck and the cards behind it`
