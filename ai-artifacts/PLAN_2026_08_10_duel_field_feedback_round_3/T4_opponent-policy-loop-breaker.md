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
- `tests/integration/programmed-duel.test.ts:55-85,455-457` — deterministic real-WASM replay runs each scenario twice, hashes the full trace, then checks human-response count, diagnostics, disposal and coverage.
- `tests/fixtures/transcripts/basic-duel-v1.json:6` — `battle-and-chain` trace digest. T4 deterministically changes it from `d9640bf2ee18ff500b5e056eb97ce5d847e53fd6d9a739aca4be1142164f9a2c` to candidate `65ae688f7b31c7c9a1f049d24ace1d2a8e526bc955bf2ea69643ebcce2b9b20d`. Before accepting, capture a temporary base-vs-candidate trace diff: first divergence must be a legal `break_loop_alternative` or `break_loop_exit`, with no unrelated pre-divergence delta; remove diagnostics, update only the reviewed digest, then rerun full integration so later golden mismatches surface.
- **From Depends (T1):** round-2 `OpponentPolicy.ts`, controller and tests are present on `plan/duel-field-feedback-round-3`; current branch terminal before T4 is pushed SHA `647e6e6ae8a446f78a00497e6c2235afb2923db3`.

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

- [x] 1. Add the ten tests above to `tests/unit/opponent-policy.test.ts`. Run `npm run test:unit -- opponent-policy` — breaker tests fail because choice A repeats.
- [x] 2. In `src/worker/opponent/OpponentPolicy.ts`, add `break_loop_alternative` and `break_loop_exit` to `OpponentDecisionReason`.
- [x] 3. Extract the current body after the empty-choice guard into `#chooseNormally(prompt)`. Do not alter branch order or decisions.
- [x] 4. Add pure `semanticChoice(choice)`, `opponentPromptSignature(prompt)` and `opponentVisibleStateFingerprint(visibleState)` helpers with the exact fields above. Do not include private card description/name/code; the visible legal address and instance id are sufficient.
- [x] 5. Add `#loop` state and the eight-step wrapper logic above. Use immutable replacement for the state object and a copied `Set<string>` of semantic choice keys. Never compare numeric `visibleState.revision`.
- [x] 6. Run the focused test until all old and new policy tests pass.
- [x] 7. Run controller tests to prove the stateful policy still satisfies the `OpponentPolicy` interface.

## Outputs

- Files edited: `src/worker/opponent/OpponentPolicy.ts`, `tests/unit/opponent-policy.test.ts`, `tests/fixtures/transcripts/basic-duel-v1.json`, `tests/fixtures/transcripts/tribute-special-v1.json`, `tests/fixtures/transcripts/effects-recovery-v1.json`, `ai-artifacts/manual_test_checklist.md`.
- Public API: `OpponentDecisionReason` gains two literals. No command/event/schema change.
- Behaviour: only a three-call unchanged-prompt loop differs.
- Reviewed golden: `battle-and-chain` trace digest `d9640bf2ee18ff500b5e056eb97ce5d847e53fd6d9a739aca4be1142164f9a2c` → `65ae688f7b31c7c9a1f049d24ace1d2a8e526bc955bf2ea69643ebcce2b9b20d`.
- `battle-and-chain` trace evidence: both full traces contain 2,628 entries. Entries 1–65 are byte-equivalent. First divergence is entry 66 for current legal id `prompt-20-choice-0-pass`: base reason `decline_optional` → candidate reason `break_loop_exit`. `PromptRegistry.respond()` accepted that current prompt id. All 54 deltas are opponent response reasons to `break_loop_exit`; choice ids, entry count and every non-response entry are unchanged.
- Reviewed later golden: `tribute-special-and-target` trace digest `362d20d431bf2639d1dfb17032a87180d967e4c7710dade3715b7d7289ed3242` → `b4e629367772d5d24253403e21f8939588640193c66ed6b3ba858395e2761225`.
- `tribute-special-and-target` trace evidence: both full traces contain 1,480 entries. Entries 1–252 are byte-equivalent. First divergence is entry 253 for current legal id `prompt-75-choice-0-pass`: base reason `decline_optional` → candidate reason `break_loop_exit`. All 26 deltas are opponent response reasons to `break_loop_exit`; choice ids, entry count and every non-response entry are unchanged.
- Reviewed later golden: `effects-recovery-and-position` trace digest `2f940dbe52d7c22385fe8c7957d9c9b0a2e8fbdf7d86deb2d8e0f65781bfcd4f` → `5b5de5159d9171cc3ebde2b7d8ff9c880678f7ba2e05f533e05d4e1ab0f26f20`.
- `effects-recovery-and-position` trace evidence: both full traces contain 1,868 entries. Entries 1–441 are byte-equivalent. First divergence is entry 442 for current legal id `prompt-133-choice-0-pass`: base reason `decline_optional` → candidate reason `break_loop_exit`. All 41 deltas are opponent response reasons to `break_loop_exit`; choice ids, entry count and every non-response entry are unchanged.
- Complete scenario review: the other four programmed traces have identical base/candidate digests and zero entry deltas.
- Temporary trace diagnostics and detached worktree lived only under `/tmp`; no diagnostic source or trace artifact remains in tracked diff.
- Migration / config: none.

## Validation

- [x] `npm run test:unit -- opponent-policy` passes
- [x] `npm run test:unit -- HeadlessDuelController` passes (use actual matching filename reported by `find tests -iname '*headless*'`)
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [x] `npm run test:integration` passes — parent rerun after one flaky Vitest fork: 7/7 files and 20/20 tests passed in 2.63s
- [x] manual diagnostic probe: use the repeated-prompt unit fixture and confirm decision reasons sequence is normal, normal, `break_loop_alternative`, `break_loop_exit`
- [x] no scoring, randomness or card-effect inspection was added
- [x] app functional — `npm run build` passed vendor/snapshot verification, Vite production build and browser-build verification
- [x] commit msg draft: `fix(opponent): break repeated unchanged prompt loops`
