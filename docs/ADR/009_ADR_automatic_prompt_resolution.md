# ADR-009: Automatic Prompt Resolution

> Status: accepted; planned
> Decided: 2026-08-09
> Owners: prompt architecture
> Plan: [`../../artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`](../../artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md) — T4, T5

## Context

`ocgcore` asks the client about everything, including things that are not decisions. A chain window with no activatable card still produces a `SELECT_CHAIN` prompt whose only choice is `Pass`. A `SELECT_OPTION` with one option still needs an answer. Summoning a monster always costs two interactions: pick the action, then pick the zone.

The product owner wants those formalities gone by default, and wants placement to happen at "the most central space possible" unless they ask to choose.

The client already has one precedent for answering on the player's behalf: `pendingPlacement` in `duel-store.ts`. Dropping a hand card on a zone arms an intent, and the *next* `SELECT_PLACE` prompt is answered with it — but only if the prompt id differs from the one the intent was armed on, only if it is `selectPlace`, only if `minimum === maximum === 1`, and only if exactly one offered place maps to that zone. Anything else drops the guess and shows the real prompt. That conservatism is the pattern to follow, not to relax.

## Decision

1. Two session settings, both **on** by default and both in-memory: `autoResolveTrivialPrompts` and `autoPlaceCards`.
2. `trivialPromptResponse(prompt)` answers only prompts that carry no decision:
   - a `chain` prompt whose only choice is `pass`;
   - a `chain` prompt with exactly one choice and no `pass` (a forced chain);
   - an `option` prompt with exactly one choice;
   - a `selectPosition` prompt with exactly one choice.
   Every branch additionally requires `prompt.player === 0`, `prompt.minimum <= 1` and `prompt.maximum >= 1`.
3. `centralPlacementResponse(prompt)` answers a `selectPlace` prompt with `minimum === maximum === 1` by picking the most central offered place. Centrality is the fixed rank `[2, 1, 3, 0, 4]` over the sequence; extra monster zones rank after every main sequence, 5 before 6; player-0 places before player-1 places; ties break on choice id.
4. `selectDisabledField` never auto-answers, even though it shares the `placeSelection` spec kind. It is a targeting decision, not a placement.
5. Resolution is attempted once per prompt id, from a reactive statement in `App.svelte`, and only when no response is already in flight. The drag-and-drop intent wins automatically: it answers from inside the client subscription, so `responsePending` is already true when the reactive statement runs.
6. When `autoPlaceCards` is off, placement becomes a single click: clicking a legal zone submits the placement directly instead of toggling it for a `Confirm placement` button, and the button stops rendering for single-place prompts.
7. Clicking outside every legal target cancels — but only for `multiple`- and `order`-family prompts, and only when `prompt.cancelable`. `validatePromptSelection` rejects an empty response for a `single`-family prompt even when it is cancelable, so cancelling one would only raise `invalid_response`. Chain prompts are the live example, and ADR-010 gives them a *pass* on outside click instead.
8. `Shuffle Deck` stops being offered. The emission is removed from `PromptRegistry`; `ChoiceAction` keeps its `"shuffle"` member because the engine constant still exists.

## Alternatives rejected

- **Auto-answer any prompt with a single legal answer.** Sounds like the same rule and is not: a forced `SELECT_CARD` with one candidate, or a `SELECT_YES_NO` the player would have declined, is a decision with consequences. The four listed kinds are the ones where the client is answering a formality, not choosing.
- **Auto-place inside the store rather than the app.** The store has no access to the settings, and giving it one couples duel state to presentation preferences.
- **Auto-place by first-offered index.** Whatever the engine happens to list first is arbitrary and changes with board state.
- **Compute centrality arithmetically** (`|sequence - 2|`). Produces `2, 3, 1, 4, 0`, which prefers the right side over the left for no reason. An explicit table is one line and reads as the decision it is.
- **Cancel a chain on outside click.** Rejected by `validatePromptSelection`; see decision 7.

## Card-list carveout (accepted 2026-08-13)

ADR-021 target-list cards always edit a draft, including exact 1/1. Card click never auto-submits there; `Validate selection` submits through existing validator. Mounted-field immediate-single behavior remains unchanged. ADR-020 does not persist this ADR's 2 automation settings.

## Consequences

- The player can no longer decline a formality they never saw. That is the point, and the setting turns it off.
- A rejected auto-response would surface as a recoverable `invalid_response` error. The once-per-prompt-id guard means it surfaces once and stops, rather than looping.
- `fieldActionBarRequired` returns `false` for a single-place prompt with no extra global choices, so the action bar stops rendering for the most common placement — which also removes it from the board's hit area during exactly the interaction that needs the board clickable.
- Every one of these behaviours is a pure function of the prompt (`trivialPromptResponse`, `centralPlacementResponse`, `placementRank`), so the whole policy is unit-testable without a duel.
- Nothing here touches the worker. The engine still receives an ordinary response for every prompt it asked.
</content>
