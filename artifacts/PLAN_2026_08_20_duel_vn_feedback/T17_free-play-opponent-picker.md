# T17: Free-play opponent picker

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T16
**Commit outcome:** A free-play match lets you choose both decks — yours and the opponent's, from presets or your own builds — and remembers the pairing.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket makes free play a sandbox instead of a fixed matchup.
- This slice: a second deck picker for the opponent seat plus persistence of the last pairing.
- Out of scope here: story duels (T27/T28 handle those), AI behaviour, deck editing.
- Assumptions in force: the opponent list is bundled presets **plus** the free-play library's own decks; the last pairing is remembered across sessions.

## Requirements

- The free-play match screen shows two pickers: "Your deck" and "Opponent deck", both listing bundled presets and free-play decks.
- The chosen pair is persisted and preselected next time.
- A `BattleRequest` is built with both selections and passed to `BattleFacade` instead of `request={null}`.
- An invalid remembered selection (deleted deck) falls back to the default deck without blocking the screen.

## Inputs

- `src/battle/index.ts` — public exports: `BattleFacade`, `parseBattleRequest`, `BattleRequestError`, `listSelectableDecks`, `findSelectableDeck`, `supportedDuelCardCodes`, `type SelectableDeck`, `type BattleRequest`, `type BattleDeckSelection`.
- `src/battle/battle-contracts.ts` — `BattleDeckSelection = { kind: "preset"; deckId } | { kind: "local"; deck: ValidatedDeckSnapshot }`, `BattleRequest = { player; opponent }`, `parseBattleRequest(value)`.
- `src/battle/decks/selectable-decks.ts:10-103` — `SelectableDeck` carries `source: "preset" | "local"`; `listSelectableDecks(...)`, `findSelectableDeck(...)`.
- `src/battle/app/components/DeckPicker.svelte` — the existing single picker, grouping presets under `deck-picker-group-preset`.
- `src/shell/settings/shell-settings-store.ts` and `SHELL_SETTINGS_KEY` (`src/shell/settings/shell-settings.ts`) — the localStorage-backed settings home for the remembered pairing.
- Tests: `tests/component/DeckPicker.test.ts`, `tests/unit/battle/selectable-decks.test.ts`, `tests/unit/shell-settings.test.ts`.

## From Depends

- T16 added `src/shell/screens/FreePlayMenuScreen.svelte` (`data-cy` `free-play-menu-screen`, `free-play-start-match`, `free-play-deck-builder`, `free-play-return`), which mounts the lazily-loaded `BattleFacade` with `request={null}` behind a local `matchStarted` flag, and gave the duel surface a Back control returning to the menu.

## TDD

1. **Red** — add `tests/component/FreePlayMatchSetup.test.ts`: `lists presets and local decks for both seats`, `builds a battle request from both selections`, `remembers the last pairing`, `falls back when a remembered deck is gone`.
2. **Green** — add a `FreePlayMatchSetup.svelte` screen that reuses `DeckPicker` twice and writes the pairing into shell settings.
3. **Refactor** — extract the pairing type into `src/shell/settings/shell-settings.ts` beside the other persisted keys.

## Test plan

| Test                                            | Input                                            | Expect                                                                      |
| ----------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| `lists presets and local decks for both seats`  | catalog with 2 presets, 1 local deck             | both pickers show 3 options                                                 |
| `builds a battle request from both selections`  | pick local for player, preset for opponent       | `parseBattleRequest` accepts the produced object; `player.kind === "local"` |
| `remembers the last pairing`                    | choose, start, return, re-enter                  | both pickers preselect the previous choice                                  |
| `falls back when a remembered deck is gone`     | remembered local deck id absent from the library | picker falls back to the default deck, no error shown                       |
| `start is disabled until both seats are chosen` | one seat empty                                   | `[data-cy="free-play-match-start"]` disabled                                |

## Impl steps

- [ ] 1. Add the failing component tests; run `npx vitest run tests/component/FreePlayMatchSetup.test.ts`.
- [ ] 2. Create `src/shell/screens/FreePlayMatchSetup.svelte` with `data-cy` values `free-play-match-setup`, `free-play-match-player-picker`, `free-play-match-opponent-picker`, `free-play-match-start`, `free-play-match-back`.
- [ ] 3. Load selectable decks through `listSelectableDecks` from `src/battle/index.ts` (a public entry, so no boundary violation) inside the lazily-loaded branch.
- [ ] 4. Add `freePlayPairing?: { player: string; opponent: string }` to the shell settings shape in `src/shell/settings/shell-settings.ts`, with parsing that drops unknown ids.
- [ ] 5. On Start, build `BattleRequest` from both selections via `findSelectableDeck`, validate it with `parseBattleRequest`, and mount `BattleFacade` with `request={request}`.
- [ ] 6. In `FreePlayMenuScreen.svelte`, change Start a match to route through this setup screen rather than mounting the duel directly.
- [ ] 7. Handle `BattleRequestError` by showing the message inline and keeping the pickers usable.
- [ ] 8. Run `npx vitest run tests/component tests/unit/shell-settings.test.ts tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/shell/screens/FreePlayMatchSetup.svelte` (new), `src/shell/screens/FreePlayMenuScreen.svelte`, `src/shell/settings/shell-settings.ts`, `src/shell/settings/shell-settings-store.ts`, `tests/component/FreePlayMatchSetup.test.ts` (new).
- Behaviour change: free play chooses both decks; the pairing persists.
- Migration/config: the settings blob gains an optional key; older blobs parse unchanged.

## Validation

- [ ] `npx vitest run tests/component/FreePlayMatchSetup.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: pick two decks, duel, come back — the pickers remember
- [ ] app functional — a duel started this way plays to a result
- [ ] commit msg draft: `feat(free-play): choose both decks for a match and remember the pairing`
