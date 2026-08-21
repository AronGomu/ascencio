# T28: Story duel plays the save deck

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T27
**Commit outcome:** A story encounter is fought with the deck you picked, instead of a bundled preset.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket closes the loop between save-owned decks and the duel.
- This slice: carry the chosen deck across the story→shell→duel handoff and build the `BattleRequest` from it.
- Out of scope here: the picker UI (T27), the opponent's deck (still the encounter's bundled preset), free play (T17).
- Assumptions in force: only the player's seat changes; the opponent keeps the encounter's preset; an illegal deck can never reach here because T27 blocks it.

## Requirements

- `StoryEncounterRequest` carries the chosen deck as a validated snapshot.
- The shell builds `BattleRequest` with `player: { kind: "local", deck }` and the encounter's preset for the opponent.
- The request is validated with `parseBattleRequest` before the duel mounts; a rejection surfaces as a story-side failure rather than a blank duel.
- The pre-duel checkpoint keeps working: the state written before the duel is the state restored after it.

## Inputs

- `src/story/handoff/story-handoff.ts`:
  ```ts
  export interface StoryEncounterRequest {
    readonly encounterId: EncounterId;
    readonly label: string;
    readonly state: StoryState;
  }
  ```
  plus `StoryEncounterIntent { handoffId; encounterId; label }`, `PendingStoryDuel`, `StoryDuelResolution`, `storyBattleResult`, `toStoryResolution`, `acceptsResult`, `restoreStoryState`, `ENCOUNTER_LABELS`.
- `src/battle/battle-contracts.ts` — `BattleDeckSelection = { kind: "preset"; deckId } | { kind: "local"; deck: ValidatedDeckSnapshot }`, `BattleRequest { player; opponent }`, `parseBattleRequest(value)`, `BattleRequestError`, and the `ZONE_LIMITS` guard (`main: 60, extra: 15, side: 15`).
- `src/decks/deck-contracts.ts` — `ValidatedDeckSnapshot { ref: { type: "local"; deckId; revision }; name; main; extra; side; validationDigest }`; `src/decks/deck-resolver.ts` — `resolveDeck`.
- `src/shell/handoff/handoff-coordinator.ts` — the shell side of the handoff.
- `src/shell/AppShell.svelte` lines 255-256 — the `BattleFacade` mount currently passing `request={null}`.
- Tests: `tests/component/StoryDuelHandoff.test.ts`, `tests/unit/story/`, `tests/component/BattleFacade.test.ts`.

## From Depends

- T27 added the pre-battle deck picker (`[data-cy="story-pre-battle-deck-picker"]`, options `story-pre-battle-deck-<id>`), disabled illegal decks, blocked `story-pre-battle-start` with `[data-cy="story-pre-battle-block-reason"]` linking to `#/story/decks`, and dispatches `deck-set-default` when the selection changes. The selected deck is therefore always legal and always recorded in `StoryState.defaultDeckId`.

## TDD

1. **Red** — add `tests/component/StoryDuelHandoff.test.ts` cases: `the handoff carries the chosen deck`, `the shell builds a local player selection`, `an unparseable request fails the encounter instead of mounting a duel`.
2. **Green** — widen the handoff type, resolve the deck, build and validate the request.
3. **Refactor** — keep `storyBattleResult` / `toStoryResolution` untouched; only the outbound half changes.

## Test plan

| Test                                                 | Input                             | Expect                                                           |
| ---------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `the handoff carries the chosen deck`                | start an encounter with deck `d1` | the request's `deck.ref.deckId === "d1"`                         |
| `the shell builds a local player selection`          | same                              | `BattleRequest.player.kind === "local"`; opponent stays `preset` |
| `the request passes parseBattleRequest`              | same                              | no `BattleRequestError`                                          |
| `an unparseable request fails the encounter`         | corrupt snapshot (61 main cards)  | story shows a failure; no duel mounts                            |
| `the pre-duel checkpoint still round-trips`          | start, then return                | restored state equals the checkpointed state                     |
| `the duel result still maps to the story's branches` | win / loss / abort / failure      | unchanged mapping through `toStoryResolution`                    |

## Impl steps

- [ ] 1. Add the failing tests; run `npx vitest run tests/component/StoryDuelHandoff.test.ts`.
- [ ] 2. In `src/story/handoff/story-handoff.ts`, add `readonly deck: ValidatedDeckSnapshot;` to `StoryEncounterRequest` (import the type from `src/decks/index.ts`, which is the shared library entry).
- [ ] 3. In the story screen that raises the encounter, resolve the chosen `StoryDeck` into a `ValidatedDeckSnapshot` with `resolveDeck` and include it in the request.
- [ ] 4. In `src/shell/handoff/handoff-coordinator.ts`, build `BattleRequest` as `{ player: { kind: "local", deck }, opponent: { kind: "preset", deckId: <encounter preset> } }` and run it through `parseBattleRequest`.
- [ ] 5. In `AppShell.svelte`, pass that request into `BattleFacade` for the `duel-session` route instead of `null`.
- [ ] 6. Map a `BattleRequestError` onto the story's `failure` resolution so the encounter reports it rather than mounting an empty duel.
- [ ] 7. Run `npx vitest run tests/component/StoryDuelHandoff.test.ts tests/component/BattleFacade.test.ts tests/unit/story`.
- [ ] 8. Run `npm run test:e2e` for the story-duel smoke path.

## Outputs

- Files touched: `src/story/handoff/story-handoff.ts`, the story screen raising the encounter, `src/shell/handoff/handoff-coordinator.ts`, `src/shell/AppShell.svelte`, `tests/component/StoryDuelHandoff.test.ts`.
- Public API change: `StoryEncounterRequest` (exported from `src/story/index.ts`) gains `deck`.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/StoryDuelHandoff.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] `npm run test:e2e` passes
- [ ] manual: pick a deck at pre-battle and see those exact cards in the duel's opening hand
- [ ] app functional — the story's win/loss/abort branches still fire
- [ ] commit msg draft: `feat(story): encounters are fought with the deck the save chose`
