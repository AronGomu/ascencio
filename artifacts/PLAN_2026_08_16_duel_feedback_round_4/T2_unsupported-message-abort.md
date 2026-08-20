# T2: unsupported_message duel abort repro + fix

**Plan:** `./artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** T1
**Commit outcome:** Spellbook duel no longer aborts with `unsupported_message`; the specific unsupported engine flow is supported (or handled recoverably) with a pinned regression test.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5 + ocgcore WASM worker). User bug: "After a few actions in each duel, the connection is interrupted and a technical failure stops the duel" (launched via story menu). Console trace: `{event: 'duel.worker.command.failed', commandType: 'respond', code: 'unsupported_message', ...}` then `duel.worker.detached`.
- This slice: worker-side. `unsupported_message` is thrown only in `src/battle/worker/HeadlessDuelController.ts` (4 sites: "ocgcore emitted multiple player prompts in one process batch", "ocgcore ended without emitting a duel result", "ocgcore is waiting but emitted no supported player prompt", reconciliation failures "Unable to reconcile … state") — plus projection reconcile wrapper. `duel-store.ts` treats it non-recoverable → status `failed` → duel dies. Story shell surfaces it as "technical failure".
- Predecessor T1 produced: `tests/integration/field-spell-activation.test.ts` — programmed spellbook duel harness (player deck spellbook preset, drives real WASM core, answers prompts by choice). Reuse its setup verbatim. T1 also fixed `mapEngineFieldAddress` (`src/battle/field/duel-field-layout.ts`) so `spellTrap` seq 5 = field zone.
- Out of scope here: UI changes, retry UX, making all `unsupported_message` recoverable wholesale.
- Assumptions in force: bug reproducible with spellbook deck continuing past field-spell activation (user played spellbook via story). If several turns needed, script them.

## Requirements

- Reproduce the abort deterministically in an integration test before any fix.
- Identify exact failing site via `BoundedDuelTrace` (`controller.trace()` — entries carry `kind: "message" | "prompt" | "promptDiagnostic" | "error"`).
- Fix root cause: either support the missing engine message/prompt kind in `src/battle/worker/protocol/PromptRegistry.ts` `publish(message)` / `src/battle/worker/protocol/message-classification.ts`, or fix the reconciliation path — whichever the repro shows.
- Regression test pinned green.

## Inputs

- `src/battle/worker/HeadlessDuelController.ts` — `#advanceUntilBoundary()`, `respond()`, `#reconcile()`.
- `src/battle/worker/protocol/PromptRegistry.ts` — `publish` returns `null` for unsupported messages; a waiting boundary with only-null prompts triggers "no supported player prompt".
- `src/battle/worker/protocol/message-classification.ts` — message type → class table.
- `src/battle/worker/diagnostics/duel-trace.ts` — `BoundedDuelTrace.snapshot()`.
- Harness: `tests/integration/field-spell-activation.test.ts` (from T1) + `tests/integration/programmed-duel.test.ts` pattern.
- Opponent seat: `src/battle/duel/presets/decks/opponent.ydk` preset (same as story flow).

## TDD

1. **Red** — Integration `tests/integration/spellbook-duel-progression.test.ts` (new) — test name: `a spellbook duel survives repeated effect activations without unsupported_message`. Script: start spellbook vs opponent preset; loop up to 200 human prompts: prefer `activate` choices, else first valid choice, else pass/end; assert no `DuelOperationError` with `code === "unsupported_message"` escapes `advance()`/`respond()`. On failure, print `controller.trace().entries.slice(-30)` — the last `message`/`promptDiagnostic` entries name the unsupported engine message type. Confirm red (reproduced) BEFORE fixing. If 200 scripted prompts do not reproduce: bisect with the exact user path (activate Grand Spellbook Tower turn 1, then keep activating spellbook spells); if still green, mark the assumption dead, record findings in commit body, and pivot the red test to drive whichever engine message type the trace showed as `prompt:<type>` diagnostic with no published prompt.
2. **Green** — implement support for the identified message (most likely: a `MSG_*` type `PromptRegistry.publish` returns `null` for, e.g. an announce/sort/hint variant used by spellbook cards). Add prompt kind only if `player-prompt.ts` already names it; otherwise map onto existing kind semantics. Keep `duel-store` non-recoverable handling untouched.
3. **Refactor** — if fix is in `publish`, add the message type to `tests/unit/prompt-registry.test.ts` with a table-driven case.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| a spellbook duel survives repeated effect activations without unsupported_message | scripted spellbook vs opponent duel, ≤200 prompts | no `unsupported_message` error; duel reaches result or prompt #200 |
| (unit, shape depends on findings) publish supports <identified message> | synthetic engine message | non-null `PlayerPrompt` with correct kind/choices |

## Impl steps

- [ ] 1. Write `tests/integration/spellbook-duel-progression.test.ts`; run `npm run test:integration -- tests/integration/spellbook-duel-progression.test.ts`; confirm red; copy trace tail into ticket notes/commit body.
- [ ] 2. Locate the failing site from trace (`promptDiagnostic`/`message` entries + which of the 4 throw messages fired).
- [ ] 3. Implement minimal support/fix at that site (`PromptRegistry.publish` or `message-classification.ts` or `DuelStateProjector` reconcile input).
- [ ] 4. Add/extend unit test in `tests/unit/prompt-registry.test.ts` (or `tests/unit/duel-state-projector.test.ts`) pinning the exact message shape from the trace.
- [ ] 5. `npm run test:integration && npm run test:unit` → green.
- [ ] 6. `npm run typecheck && npm run lint`.
- [ ] 7. Manual check: `npm run dev`, play spellbook duel from story menu (`#/story`) several turns → no "Duel stopped" panel.

## Outputs

- Files touched: `tests/integration/spellbook-duel-progression.test.ts` (new), one of `src/battle/worker/protocol/PromptRegistry.ts` / `src/battle/worker/protocol/message-classification.ts` / `src/battle/worker/projection/DuelStateProjector.ts`, matching unit test file.
- Behavior: previously-unsupported engine flow now produces a prompt/state instead of killing the worker.
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:integration`, `npm run test:unit`
- [ ] manual check: multi-turn spellbook duel via story menu survives
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `fix(worker): support the engine flow that aborted spellbook duels with unsupported_message`
