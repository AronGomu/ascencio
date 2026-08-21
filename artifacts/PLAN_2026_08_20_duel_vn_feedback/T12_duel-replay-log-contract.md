# T12: Replay log contract

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T3
**Commit outcome:** The worker can rebuild a duel from its own recorded responses up to a chosen point, and the UI can ask it to, through a typed contract.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is the engine half of `feedback-duel.md` item 9; T13 builds the dialog on top.
- This slice: the replay mechanism only. No UI. The vendored core exposes no state snapshot, so recovery is a fresh session with the same seed replaying the recorded response log.
- Out of scope here: the error dialog and its buttons (T13), diagnostics download (already shipped), any change to how responses are chosen.
- Assumptions in force: the rewind target is the last decision the **player** had agency over; the opponent's recorded responses before that point are replayed verbatim so the position is reproduced exactly.

## Requirements

- A worker command rebuilds the duel: create a session with the recorded `seed`, `presetId`/deck selection and snapshot id, then feed recorded responses in order up to and excluding the last human response.
- The rebuilt session stops at that prompt and surfaces it to the UI as a live prompt, exactly as a fresh prompt would arrive.
- `canRestore` is false when the trace holds no human response.
- The replay never consults the opponent policy for a response it already has recorded; the policy resumes only after the replay point.
- Replay failure is reported as a typed failure, leaving the previous error state intact.

## Inputs

- `src/battle/worker/diagnostics/duel-trace.ts` — the trace recorder: schema v2, `seed`, `presetId`, `snapshotId`, `coreVersion`, `revisions`, and `entries` of kinds `lifecycle | process | message | presentation | prompt | response | error`. A `response` entry carries `promptId`, `choiceIds`, `player` and, for the opponent, `opponentReason`; a human response has **no** `opponentReason`.
- `tests/integration/programmed-duel.test.ts` — the existing harness that replays a persisted response log against a fixed seed with no policy fallback. Its setup is the model for the replay routine.
- `src/battle/worker/HeadlessDuelController.ts` — session creation and the prompt loop.
- `src/battle/worker/DuelWorkerRuntime.ts` and `src/battle/app/DuelWorkerClient.ts` — the command/event channel to extend.
- `src/battle/duel/contracts/duel-worker-event.ts` and the command contract beside it — where the new message shapes are declared.
- `src/battle/app/stores/duel-store.ts` — the store the UI reads; it must learn the new state.

## From Depends

- T3 pinned every response encoder with one unit test per prompt kind and documented the field semantics in `docs/ADR/046_ADR_engine_response_encoding_contract.md`. T2 before it fixed `ANNOUNCE_NUMBER` to answer with the option index. The replay therefore reproduces answers the core accepts.

## TDD

1. **Red** — add `tests/integration/duel-replay-restore.test.ts`: play a scripted duel forward, force a failure, then call the restore routine and assert the rebuilt session is waiting on the same prompt id the last human response answered.
2. **Green** — implement `restoreToLastHumanDecision` in the worker runtime plus the command/event pair.
3. **Refactor** — share the replay loop with `programmed-duel.test.ts`'s helper if the duplication is exact; otherwise leave both.

## Test plan

| Test                                                             | Input                                                 | Expect                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| `restores to the prompt the last human response answered`        | trace with 3 human responses, failure after the third | rebuilt session's live prompt id equals the third human prompt id   |
| `replays opponent responses verbatim`                            | same trace                                            | opponent policy is never consulted for replayed turns (spy count 0) |
| `reports canRestore false with no human response`                | trace whose only responses carry `opponentReason`     | `canRestore === false`                                              |
| `a failed replay leaves the previous error visible`              | corrupt one recorded response                         | typed `restore_failed` event; store still holds the original error  |
| `restored state is byte-identical to the original at that point` | replay twice                                          | the two projections match                                           |

## Impl steps

- [ ] 1. Add the failing integration test; run `npx vitest run tests/integration/duel-replay-restore.test.ts`.
- [ ] 2. In `duel-trace.ts`, add a reader `humanResponsesBefore(trace)` returning the recorded responses in order and the index of the last entry without `opponentReason`; export a `RestorePlan` type `{ seed; snapshotId; responses: readonly RecordedResponse[]; stopAtPromptId: string }`.
- [ ] 3. Add `buildRestorePlan(trace): RestorePlan | null` returning `null` when there is no human response.
- [ ] 4. In `DuelWorkerRuntime.ts`, add a `restore` command handler: build the plan, create a new session from the recorded seed and deck selection, and feed each recorded response through the same path a live response takes, stopping before `stopAtPromptId`.
- [ ] 5. Guard the replay so the opponent policy is not invoked while recorded responses remain.
- [ ] 6. Declare the command and the `restored` / `restore_failed` events in the worker contracts, and add `canRestore: boolean` to the state the worker publishes.
- [ ] 7. Extend `DuelWorkerClient.ts` with a `restore()` method and `duel-store.ts` with the resulting state transition.
- [ ] 8. Run `npx vitest run tests/integration` and `npx vitest run tests/unit/duel-worker-client.test.ts tests/unit/duel-store.test.ts`.
- [ ] 9. Write `docs/ADR/048_ADR_replay_based_duel_recovery.md`: context (no core state snapshot; a rejected response ends the duel), decision (deterministic replay from the recorded seed and response log to the last human decision), consequences (recovery costs a full replay, is exact, and needs the trace to stay in memory for the session).

## Outputs

- Files touched: `src/battle/worker/diagnostics/duel-trace.ts`, `src/battle/worker/DuelWorkerRuntime.ts`, `src/battle/duel/contracts/duel-worker-event.ts` (+ the command contract beside it), `src/battle/app/DuelWorkerClient.ts`, `src/battle/app/stores/duel-store.ts`, `tests/integration/duel-replay-restore.test.ts` (new), `docs/ADR/048_ADR_replay_based_duel_recovery.md` (new).
- Public API change: the worker gains a `restore` command and `restored` / `restore_failed` events; the published duel state gains `canRestore`.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/integration/duel-replay-restore.test.ts` passes
- [ ] `npm run test:integration` passes
- [ ] `npm run check:headless` passes
- [ ] app functional — a normal duel is unaffected; no UI change is visible yet
- [ ] commit msg draft: `feat(duel-worker): rebuild a duel from its recorded responses to the last decision you owned`
