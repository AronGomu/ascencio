# T25: Ownership legality

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T22
**Commit outcome:** A story deck that uses cards the save no longer owns is reported as illegal, with the offending cards named, everywhere decks are listed.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket makes the ownership invariant observable.
- This slice: a validation rule plus the badge that surfaces it. Selling stays unrestricted (T26 warns before it commits); the encounter gate is T27.
- Out of scope here: blocking a sale, the pre-battle screen, catalog filtering (T24).
- Assumptions in force: ownership legality applies only in a story context; free play's unlimited ownership can never produce this issue.

## Requirements

- Deck validation gains an issue code `not-owned` at severity `error`, carrying the card code.
- The issue is raised once per code whose used copies exceed `ownedCount(code)`.
- Free play never raises it.
- Deck lists render an illegal badge with a red border for any deck whose validation holds an error, and the badge names ownership when that is the cause.
- The rule is pure: it takes the deck and an ownership snapshot and returns issues.

## Inputs

- `src/decks/deck-validation.ts` — `validateDeckDraft(...)`, the function producing `DeckValidationSummary`.
- `src/decks/deck-contracts.ts` — `DeckValidationIssue` with its `code` union (`main-under-minimum`, `main-over-maximum`, `extra-over-maximum`, `side-over-maximum`, `copy-limit`, `forbidden`, `wrong-zone`, `missing-card`, `unsupported-card`, `empty-extra`, `empty-side`, `missing-art`, `ruleset-changed`, `import-review`) and `DeckValidationSummary { status: "valid" | "warnings" | "errors"; issues; rulesetRevision }`.
- `src/story/decks/card-ownership.ts` — after T22: `CardOwnership { ownedCount(code): number; isUnlimited: boolean }`.
- `src/deck-editor/components/DeckLibrary.svelte` and `ValidationIssues.svelte` — where a deck's status is shown.
- Tests: `tests/unit/decks/`, `tests/component/deck-editor/`.

## From Depends

- T22 added `src/story/decks/card-ownership.ts` exporting the `CardOwnership` interface, `storyCardOwnership(state)` and `unlimitedCardOwnership()`, all re-exported from `src/story/index.ts` and listed in `tests/unit/domain-boundaries.test.ts`. ADR-050 records that every card in a story deck must be a card that save owns.

## TDD

1. **Red** — add `tests/unit/decks/ownership-validation.test.ts` with the cases below.
2. **Green** — add the `not-owned` code and the rule, and pass ownership into validation.
3. **Refactor** — reuse the copy-counting helper from T24's `catalog-availability.ts` rather than counting twice.

## Test plan

| Test                                       | Input                                | Expect                                                                 |
| ------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------- |
| `a deck using an unowned card is an error` | deck with 2 copies, collection has 1 | one `not-owned` issue for that code, severity `error`, status `errors` |
| `a deck within its owned copies is clean`  | 1 copy, own 1                        | no `not-owned` issue                                                   |
| `the issue counts across zones`            | 1 in main + 1 in side, own 1         | one `not-owned` issue                                                  |
| `free play never raises it`                | unlimited ownership                  | no `not-owned` issue                                                   |
| `existing issue codes are unaffected`      | 39-card deck                         | still `main-under-minimum`                                             |
| `deck list shows an illegal badge`         | deck with an error summary           | `[data-cy="deck-library-illegal-<id>"]` present with the red style     |

## Impl steps

- [ ] 1. Add the failing unit tests; run `npx vitest run tests/unit/decks/ownership-validation.test.ts`.
- [ ] 2. Add `"not-owned"` to the `code` union in `src/decks/deck-contracts.ts`.
- [ ] 3. Extend `validateDeckDraft` with an optional `ownership?: CardOwnership` input; when present and not unlimited, emit one `not-owned` error per over-used code, with a message naming the card and the counts.
- [ ] 4. Pass the context's ownership into every validation call from the editor store (T23 supplies it).
- [ ] 5. In `DeckLibrary.svelte`, render an illegal badge at `data-cy={`deck-library-illegal-${deck.id}`}` when `deck.validation.status === "errors"`, styled with the red border token.
- [ ] 6. In `ValidationIssues.svelte`, make sure a `not-owned` issue renders its message like the other error codes.
- [ ] 7. Run `npx vitest run tests/unit/decks tests/component/deck-editor tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/decks/deck-contracts.ts`, `src/decks/deck-validation.ts`, `src/deck-editor/deck-editor-store.ts`, `src/deck-editor/components/DeckLibrary.svelte`, `src/deck-editor/components/ValidationIssues.svelte`, `src/styles/app.css`, `tests/unit/decks/ownership-validation.test.ts` (new).
- Public API change: `DeckValidationIssue["code"]` gains `not-owned`.
- Migration/config: none — validation is recomputed on load.

## Validation

- [ ] `npx vitest run tests/unit/decks/ownership-validation.test.ts` passes
- [ ] `npx vitest run tests/component/deck-editor` passes
- [ ] `npm run check:headless` passes
- [ ] manual: sell a card a deck uses, then open the deck list — that deck is badged illegal and names the card
- [ ] app functional — free-play decks are never badged for ownership
- [ ] commit msg draft: `feat(decks): a story deck using cards you no longer own is reported illegal`
