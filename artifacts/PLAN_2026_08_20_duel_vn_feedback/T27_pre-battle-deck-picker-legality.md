# T27: Pre-battle deck picker

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T25
**Commit outcome:** The pre-battle screen picks from the save's own decks, shows illegal decks disabled with a red border and a warning, and refuses to start a duel with one.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket puts the deck choice in front of a story encounter.
- This slice: the picker and the gate. Actually handing the chosen deck to the duel is T28.
- Out of scope here: the battle handoff payload (T28), free play's pickers (T17), the editor (T23/T24).
- Assumptions in force: the default deck is preselected; illegal decks appear but cannot be chosen; blocking names the reason and links to the deck editor.

## Requirements

- The pre-battle screen lists that save's decks with the default preselected.
- A deck whose validation status is `errors` renders disabled, red-bordered, with the first error message shown.
- Starting is blocked while the selected deck is illegal or absent, with a named reason and a link to `#/story/decks`.
- Choosing a legal deck records it as the encounter's deck for T28 to use.
- A save with no decks at all shows the same block with a "build a deck" call to action.

## Inputs

- `src/story/screens/PreBattleScreen.svelte` — the current pre-duel screen (`data-cy` values prefixed `story-pre-battle-`).
- `src/story/model/story-state.ts` — after T18: `decks: readonly StoryDeck[]`, `defaultDeckId: string | null`; `encounterId`, `pendingHandoffId`.
- `src/decks/deck-contracts.ts` — `DeckValidationSummary { status: "valid" | "warnings" | "errors"; issues }`; after T25 the issues can include `not-owned`.
- `src/story/model/story-reducer.ts` — after T18: `deck-set-default`; `start-battle` is the command the screen already dispatches.
- `src/shell/routes.ts` — after T14: `{ kind: "story-decks" }` formats to `#/story/decks`.
- Tests: `tests/component/story/`, `tests/unit/story/`.

## From Depends

- T25 added the `not-owned` error code and taught `validateDeckDraft` to emit it from a `CardOwnership`; deck lists already badge `errors` decks via `[data-cy="deck-library-illegal-<id>"]`. T22 (its predecessor) provides `storyCardOwnership(state)`.

## TDD

1. **Red** — add `tests/component/story/pre-battle-deck-picker.test.ts` with the cases below.
2. **Green** — add the picker and the gate to `PreBattleScreen.svelte`.
3. **Refactor** — reuse the illegal badge styling from T25 rather than a second red rule.

## Test plan

| Test                                                  | Input                                      | Expect                                                            |
| ----------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `lists the save's decks with the default preselected` | 3 decks, default is the second             | 3 options; the second is selected                                 |
| `an illegal deck is disabled and red`                 | one deck with `status: "errors"`           | its option is `disabled` and carries the illegal style            |
| `an illegal deck shows its first error`               | `not-owned` issue                          | the issue's message is visible                                    |
| `start is blocked while the selection is illegal`     | select the illegal deck (programmatically) | `[data-cy="story-pre-battle-start"]` disabled with a named reason |
| `the block links to the deck editor`                  | blocked state                              | a link whose href is `#/story/decks`                              |
| `a save with no decks shows a build call to action`   | `decks: []`                                | block with a build-a-deck message                                 |
| `choosing a legal deck enables start`                 | select a valid deck                        | start enabled; the chosen deck id is recorded                     |

## Impl steps

- [ ] 1. Add the failing component tests; run `npx vitest run tests/component/story/pre-battle-deck-picker.test.ts`.
- [ ] 2. In `PreBattleScreen.svelte`, add a deck `<select>` (or a list of buttons) at `data-cy="story-pre-battle-deck-picker"`, one option per deck at `data-cy={`story-pre-battle-deck-${deck.id}`}`.
- [ ] 3. Preselect `defaultDeckId`, falling back to the first legal deck.
- [ ] 4. Disable options whose `validation.status === "errors"` and render the first issue message at `data-cy={`story-pre-battle-deck-issue-${deck.id}`}`.
- [ ] 5. Compute a `blockReason: string | null` and disable `story-pre-battle-start` while it is non-null, showing the reason at `data-cy="story-pre-battle-block-reason"` with a link to `#/story/decks`.
- [ ] 6. Dispatch `deck-set-default` when the player changes the selection, so the choice persists with the save.
- [ ] 7. Leave `start-battle` dispatching as it does today; T28 extends the payload.
- [ ] 8. Run `npx vitest run tests/component/story tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/screens/PreBattleScreen.svelte`, `src/styles/app.css` or `src/story/styles.css` (illegal option styling), `tests/component/story/pre-battle-deck-picker.test.ts` (new).
- Behaviour change: an encounter cannot start with an illegal or missing deck.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/story/pre-battle-deck-picker.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: with a broken deck selected, start is disabled and explains why; the link opens the story deck editor
- [ ] app functional — a legal deck still starts the encounter
- [ ] commit msg draft: `feat(story): choose the encounter deck at pre-battle and refuse illegal ones`
