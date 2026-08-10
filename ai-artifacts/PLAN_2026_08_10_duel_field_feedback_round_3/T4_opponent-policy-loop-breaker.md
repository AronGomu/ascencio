# T4: Opponent policy loop breaker

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T1
**Commit outcome:** The opponent can no longer answer a prompt into the same unchanged prompt forever. Its first-legal strategy is otherwise untouched.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md` and make the four new decks manually playable. This ticket is not a numbered visual item; it removes the repeated-prompt deadlock that would make manual deck checks impossible.
- Symptom: the stateful duel loop can return the same legal prompt after the opponent's first-legal answer did not change public game state. `BasicOpponentPolicy` chooses the same answer again until `HeadlessDuelController.#maximumAutomaticResponses` throws.
- Source correction: `DuelStateProjector.apply()` increments numeric `revision` for every engine message, including prompt messages handled by its `default` branch. Repeated prompts therefore never share a numeric revision. Treating `visibleState.revision` as the unchanged-state test would make the requested breaker dead code.
- This slice: a deterministic, local circuit breaker inside `BasicOpponentPolicy` only. Compare a visible-state fingerprint that excludes the noisy revision counter.
- Out of scope: changing projector revision semantics; evaluating card effects; scoring board positions; choosing better summons, targets or attacks; changing `HeadlessDuelController`'s 1,000-response fuse; adding random choices.
- Assumption **A6**: preserve all first-legal heuristics. Trip after **three consecutive calls** with one semantic prompt signature and one unchanged visible-state fingerprint; choose another legal option; after non-exit options are exhausted choose pass / phase advancement / finish. No new engine state.

## Requirements

- Calls 1 and 2 for one prompt signature at one revision return the existing decision unchanged.
- Call 3 chooses the first as-yet-untried, non-exit legal single choice in prompt order.
- Later identical calls choose the next untried, non-exit choice. Once exhausted, choose the first legal exit action in this order: `pass`, `mainPhase2`, `endPhase`, `finish`, `cancel`.
- The breaker applies only when the normal decision has exactly one choice id and `prompt.maximum === 1`. Multi-choice, sum, order and counter decisions retain current logic.
- A changed semantic prompt or changed visible-state fingerprint resets all loop history. Numeric `visibleState.revision` is intentionally ignored.
- Prompt `id` and display `label` are excluded from the semantic signature; prompt kind, constraints and choice semantics are included. Reissued equivalent prompts therefore count as repeats.
- Every returned id comes from the current prompt. No illegal response can be invented.
- Decisions emitted by the breaker have explicit trace reasons.

## Inputs

- `src/worker/opponent/OpponentPolicy.ts:14-25` — `OpponentDecisionReason`; `:61-66` — `OpponentPolicy.choose`; `:95-224` — `BasicOpponentPolicy`. `choose` currently ignores `visibleState` at line 106 and switches directly on `prompt.kind`.
- `src/worker/HeadlessDuelController.ts:114-118` — automatic-response loop capped at 1,000; `:94-97` constructs one `BasicOpponentPolicy` per duel controller.
- `src/worker/diagnostics/duel-trace.ts:29` — stores `OpponentDecisionReason`; its union widens automatically when imported.
- `src/duel/contracts/player-prompt.ts:75-84` — `PromptChoice`: `id`, `label`, `action`, optional `card`, `place`, `value`, `selected`, `allocationMaximum`; `:86-101` — prompt constraints.
- `tests/unit/opponent-policy.test.ts:141-332` — all policy tests. It currently creates one policy for the describe block; breaker tests must create their own policy so history cannot leak.
- **From Depends (T1):** round-2 `OpponentPolicy.ts`, controller and tests are present on the round-3 branch.

## API / state design

Extend `OpponentDecisionReason`:

```ts
| "break_loop_alternative"
| "break_loop_exit";
```

Add private state to `BasicOpponentPolicy`:

```ts
#loop: {
  stateFingerprint: string;
  promptSignature: string;
  consecutive: number;
  tried: ReadonlySet<string>;
} | null = null;
```

Refactor today's switch body into `#chooseNormally(prompt): OpponentDecision`. Public `choose(prompt, visibleState)`:

1. gets `normal = #chooseNormally(prompt)`;
2. computes `promptSignature = opponentPromptSignature(prompt)` and `stateFingerprint = opponentVisibleStateFingerprint(visibleState)`;
3. resets state to `{ consecutive: 1, tried: new Set([semantic key of the normal choice]) }` when either string changed; returns `normal`;
4. otherwise increments `consecutive` and unions `normal.choiceIds` into `tried`;
5. returns `normal` while `consecutive < 3`, `normal.choiceIds.length !== 1`, or `prompt.maximum !== 1`;
6. finds the first current choice whose id is untried and whose action is not an exit action; returns it with `break_loop_alternative`, adding its id to `tried`;
7. if none, finds exit action in the fixed order above; returns it with `break_loop_exit`;
8. if no exit exists, returns `normal` — mandatory prompts remain valid even when no escape exists.

`opponentPromptSignature(prompt)` returns `JSON.stringify` of this exact shape, excluding `prompt.id`, title, message and labels:

```ts
{
  kind: prompt.kind,
  minimum: prompt.minimum,
  maximum: prompt.maximum,
  cancelable: prompt.cancelable,
  ordered: prompt.ordered,
  requiredTotal: prompt.requiredTotal ?? null,
  sumMode: prompt.sumMode ?? null,
  choices: prompt.choices.map((choice) => ({
    action: choice.action,
    card: choice.card === undefined ? null : {
      instanceId: choice.card.instanceId,
      controller: choice.card.controller,
      location: choice.card.location,
      sequence: choice.card.sequence,
      position: choice.card.position ?? null,
    },
    place: choice.place ?? null,
    value: choice.value ?? null,
    selected: choice.selected ?? null,
    allocationMaximum: choice.allocationMaximum ?? null,
  })),
}
```

Choice ids are excluded from the signature so a reissued prompt with regenerated ids still counts; `tried` tracks a **semantic choice key**, not raw id. Use the JSON string of one mapped choice as that key. Return the current choice's current id.

`opponentVisibleStateFingerprint(visibleState)` returns `JSON.stringify` of `{ turn, turnPlayer, phase, players, chainSize }`, preserving each player's `player`, `lifePoints`, `deckCount`, `extraDeckCount`, `handCount`, `monsterCount`, `spellTrapCount`, `graveyardCount`, `banishedCount`. It deliberately excludes only `revision`. This expresses "unchanged game state" without changing the projector contract.

## TDD

1. **Red** — add breaker tests first; run and capture existing repeated choice.
2. **Green** — add only signature/history/alternate/exit logic.
3. **Refactor** — extract normal switch without changing its branches; all old expectations remain byte-for-byte green.

## Test plan

Extend `tests/unit/opponent-policy.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `keeps the normal choice for the first two identical prompts` | fresh policy; idle prompt `[summon A, summon B, end]`; same revision; two calls | both reason `summon_first_legal`, both choose A |
| `uses another legal choice on the third unchanged prompt` | same prompt and state, three calls | third chooses B with `break_loop_alternative` |
| `uses an exit after non-exit choices are exhausted` | call same prompt four times | fourth chooses end with `break_loop_exit` |
| `prefers pass before phase exits` | repeat a single-choice-capable fixture containing pass, mainPhase2 and endPhase after its one non-exit choice | exit id is pass |
| `ignores prompt-only revision increments` | three calls with identical visible fields but revisions 7, 8, 9 | third call uses the alternative |
| `resets when visible game state changes` | two calls at one fingerprint, third call with `handCount + 1` | third call uses normal choice and normal reason |
| `resets when semantic choices change` | two calls with summon A/B, third with summon A/C at same revision | third uses normal choice |
| `ignores regenerated prompt and choice ids in the signature` | equivalent semantic prompt object each call, new `prompt.id` and ids | third selects the current id for semantic choice B |
| `does not rewrite multi-choice decisions` | `selectCard`, min/max 2, same prompt called four times | every response is first two ids with `select_first_legal` |
| `falls back to normal when no alternative or exit exists` | one mandatory select choice, max 1, four calls | every response is that id; no throw |

Keep every existing test unchanged. Give every new test a fresh `new BasicOpponentPolicy(dependencies)`.

## Impl steps

- [ ] 1. Add the nine tests above to `tests/unit/opponent-policy.test.ts`. Run `npm run test:unit -- opponent-policy` — breaker tests fail because choice A repeats.
- [ ] 2. In `src/worker/opponent/OpponentPolicy.ts`, add `break_loop_alternative` and `break_loop_exit` to `OpponentDecisionReason`.
- [ ] 3. Extract the current body after the empty-choice guard into `#chooseNormally(prompt)`. Do not alter branch order or decisions.
- [ ] 4. Add pure `semanticChoice(choice)`, `opponentPromptSignature(prompt)` and `opponentVisibleStateFingerprint(visibleState)` helpers with the exact fields above. Do not include private card description/name/code; the visible legal address and instance id are sufficient.
- [ ] 5. Add `#loop` state and the eight-step wrapper logic above. Use immutable replacement for the state object and a copied `Set<string>` of semantic choice keys. Never compare numeric `visibleState.revision`.
- [ ] 6. Run the focused test until all old and new policy tests pass.
- [ ] 7. Run controller tests to prove the stateful policy still satisfies the `OpponentPolicy` interface.

## Outputs

- Files edited: `src/worker/opponent/OpponentPolicy.ts`, `tests/unit/opponent-policy.test.ts`.
- Public API: `OpponentDecisionReason` gains two literals. No command/event/schema change.
- Behaviour: only a three-call unchanged-prompt loop differs.
- Migration / config: none.

## Validation

- [ ] `npm run test:unit -- opponent-policy` passes
- [ ] `npm run test:unit -- HeadlessDuelController` passes (use actual matching filename reported by `find tests -iname '*headless*'`)
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [ ] `npm run test:integration` passes
- [ ] manual diagnostic probe: use the repeated-prompt unit fixture and confirm decision reasons sequence is normal, normal, `break_loop_alternative`, `break_loop_exit`
- [ ] no scoring, randomness or card-effect inspection was added
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `fix(opponent): break repeated unchanged prompt loops`
