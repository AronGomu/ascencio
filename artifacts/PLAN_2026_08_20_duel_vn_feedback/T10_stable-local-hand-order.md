# T10: Stable local hand order

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** A card added to your hand by a search appears at the rightmost position, and your hand stops reordering itself when the engine shuffles it.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 5.
- This slice: a **display order** for the local player's hand that is stable by arrival. The engine's own order still governs every response; only the projection the UI reads is re-ordered.
- Out of scope here: the opponent's hand (all backs, unaffected), manual drag-to-reorder of your hand, any change to how responses are indexed.
- Assumptions in force: your own hand is fully known to you, so ignoring `MSG_SHUFFLE_HAND` for your own display reveals nothing; the opponent's hand keeps engine order.

## Requirements

- The local player's hand renders in arrival order: cards keep their relative order across engine shuffles, and any newly added card is appended at the right end.
- A card leaving the hand removes it from the order without disturbing the rest.
- Responses continue to use engine indexes — the display order never leaks into a choice payload.
- The opponent's projected hand is untouched.

## Inputs

- `src/battle/worker/projection/DuelStateProjector.ts`
  - `#shuffleHand` at lines ~895-919: reorders `state.hand` to match the codes the engine sent, then calls `resequence(hand)`.
  - `insertPublicCard(toPlayer, toLocation, to.sequence, moved)` at line ~1304 — a moved card is inserted at the engine's sequence.
  - `MutableCard` carries `instanceId`, which is stable for the life of a card and is the right key for a display order.
- `src/battle/field/board-view-model.ts:195,203` — the projection to `BoardCardView`, carrying `sequence`.
- `src/battle/app/components/duel-field/HandBand.svelte:55` — `sortedCards = [...cards].sort((l, r) => l.sequence - r.sequence)`, the render order.
- `src/battle/duel/contracts/public-duel-state.ts` — the clone-safe state crossing the worker boundary; a new per-card field must be declared here.
- Tests: `tests/unit/duel-state-projector.test.ts`, `tests/unit/card-mapping.test.ts`, `tests/component/HandBand.test.ts`.

## From Depends

- T1 changed documentation only; `src/` is unchanged from `main`.

## TDD

1. **Red** — add `local hand keeps arrival order across an engine shuffle` and `a card added to the local hand lands last` to `tests/unit/duel-state-projector.test.ts`.
2. **Green** — give each hand card a `displayOrder: number` assigned on arrival and preserved through `#shuffleHand`; project it; sort by it in `HandBand` for player 0.
3. **Refactor** — keep `sequence` untouched everywhere it is used for engine addressing.

## Test plan

| Test                                                      | Input                                                | Expect                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `local hand keeps arrival order across an engine shuffle` | 5 cards, then a `MSG_SHUFFLE_HAND` reversing them    | projected `displayOrder` sequence unchanged                                 |
| `a card added to the local hand lands last`               | search adds one card                                 | the new card's `displayOrder` is the maximum in hand                        |
| `removing a card leaves the rest ordered`                 | play the middle card                                 | remaining cards keep their relative order                                   |
| `opponent hand still follows engine order`                | shuffle the opponent's hand                          | opponent projection order matches the engine's                              |
| `responses still use engine indexes`                      | choose the visually-last card                        | the dispatched choice's engine index is the engine's, not the display index |
| `HandBand renders by display order for player 0`          | cards whose `displayOrder` disagrees with `sequence` | DOM order follows `displayOrder`                                            |

## Impl steps

- [ ] 1. Add the failing projector tests; run `npx vitest run tests/unit/duel-state-projector.test.ts`.
- [ ] 2. In `DuelStateProjector.ts`, add `displayOrder: number` to `MutableCard` and a per-player monotonic counter `#handArrivalCounter[player]`.
- [ ] 3. Assign `displayOrder = this.#handArrivalCounter[player]++` whenever a card is inserted into a hand (the `insertPublicCard` path with `toLocation === "hand"`, and the initial draw path around line 879).
- [ ] 4. In `#shuffleHand`, reorder as the engine says for engine addressing, but do **not** touch `displayOrder`.
- [ ] 5. Add `displayOrder` to the public card shape in `src/battle/duel/contracts/public-duel-state.ts` and thread it through `board-view-model.ts` into `BoardCardView`.
- [ ] 6. In `HandBand.svelte`, sort by `displayOrder` when `player === 0` and keep sorting by `sequence` for the opponent.
- [ ] 7. Run `npx vitest run tests/unit/duel-state-projector.test.ts tests/unit/card-mapping.test.ts tests/component/HandBand.test.ts`.
- [ ] 8. Run `npm run test:integration` to confirm recorded duels still answer identically.
- [ ] 9. Write `docs/ADR/047_ADR_local_hand_display_order.md`: context (engine shuffles the hand after a search; the UI adopted that order), decision (arrival-ordered display for the local hand only; engine order still authoritative for responses), consequences (no information leak, opponent unaffected).

## Outputs

- Files touched: `src/battle/worker/projection/DuelStateProjector.ts`, `src/battle/duel/contracts/public-duel-state.ts`, `src/battle/field/board-view-model.ts`, `src/battle/app/components/duel-field/HandBand.svelte`, the three test files above, `docs/ADR/047_ADR_local_hand_display_order.md` (new).
- Behaviour change: your hand stops reshuffling; searched cards land on the right.
- Migration/config: none (projection is rebuilt per duel).

## Validation

- [ ] `npx vitest run tests/unit/duel-state-projector.test.ts` passes
- [ ] `npm run test:integration` passes
- [ ] `npm run check:headless` passes
- [ ] manual: resolve a search effect — the fetched card appears at the right end and the rest of the hand does not move
- [ ] app functional — plays, targets and drops still address the right cards
- [ ] commit msg draft: `feat(hand): stable arrival order for your own hand, searched cards land rightmost`
