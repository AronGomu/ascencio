# T1: Field spell zone address fix

**Plan:** `./artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Activating a field spell (The Grand Spellbook Tower) keeps duel field mounted; card renders in Field Zone.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5 + ocgcore WASM worker). This ticket = user bug: "After activating The Grand Spellbook Tower, the duel field became unavailable, and now I have a decision dialog to perform all actions."
- This slice: engine→UI zone-address mapping bug. When board mapping fails, `App.svelte` renders "Duel field unavailable" panel (`data-cy="app-field-error-panel"`) + every prompt falls back to `PromptDialog`. Exactly the reported symptom.
- Root-cause hypothesis (verify first, do not assume): ocgcore addresses field-spell zone as location SPELL_TRAP (8) sequence 5. Projection carries it as `PublicCard { location: "spellTrap", sequence: 5 }`. `mapEngineFieldAddress` in `src/battle/field/duel-field-layout.ts` case `"spellTrap"` rejects sequence > 4 → `mapSnapshotToBoard` (in `src/battle/field/board-view-model.ts`) returns `{ ok: false, error: { type: "unsupported_fixed_card", ... } }` → field unmounts.
- Out of scope here: the `unsupported_message` mid-duel abort (next ticket T2), prompt place decoding changes beyond what repro shows, engine vendor changes.
- Assumptions in force: MODE_MR3/MR5 pinned (see `EngineDuelFlag` in `src/battle/worker/engine/engine-constants.ts`); pendulum handled as `spellTrap` 0/4 already.

## Requirements

- Deterministic repro test proving field-spell activation reaches a snapshot whose board mapping fails today.
- After fix: card sits in `p0:field` physical zone; `mapSnapshotToBoard(...).ok === true`; duel continues.
- Engine response round-trip untouched: `PromptRegistry` keeps answering the core with the raw engine place it decoded.

## Inputs

- `src/battle/field/duel-field-layout.ts` — `mapEngineFieldAddress(address)`; current `case "spellTrap": if (sequence < 0 || sequence > 4) return unsupported(address);`
- `src/battle/field/board-view-model.ts` — `mapSnapshotToBoard`, `fixedCardsIn`, error type `unsupported_fixed_card`.
- `src/battle/worker/protocol/PromptRegistry.ts` — `decodeAvailablePlaces(mask, selectingPlayer)` (spellTrap bit offsets 8/24, sequences 0..7), `engineToPublicLocation`, `publicToEngineLocation`.
- Integration harness pattern: `tests/integration/programmed-duel.test.ts` (drives a real WASM duel via `create-node-runtime`/`HeadlessDuelController`). Spellbook deck: `src/battle/duel/presets/decks/spellbook.ydk`.
- Find Grand Spellbook Tower code: `grep -i "spellbook tower" generated/ -r` or search `activeCatalog()` card texts; cross-check the code exists in `spellbook.ydk`.
- Unit test files that exist and may extend: `tests/unit/duel-field.test.ts` (board mapping), `tests/unit/prompt-registry.test.ts`.

## TDD

1. **Red**
   - Unit `tests/unit/duel-field.test.ts` — test name: `maps a field spell reported at spellTrap sequence 5 into the field zone`. Build snapshot fixture (reuse `tests/fixtures/board-public-states.ts` helpers) with player-0 card `location: "spellTrap", sequence: 5, faceUp: true`. Assert `mapSnapshotToBoard(snapshot).ok === true` and mapped card `zoneId === "p0:field"`. Fails today with `unsupported_fixed_card`.
   - Unit `tests/unit/duel-field.test.ts` — test name: `still rejects spellTrap sequences 6 and 7`. Assert mapping failure for sequences 6, 7 (do not silently invent pendulum slots).
   - Integration `tests/integration/field-spell-activation.test.ts` (new) — test name: `activating a field spell keeps the projected board mappable`. Programmed duel (copy setup from `tests/integration/programmed-duel.test.ts`), player deck = spellbook preset, script: advance to first idle prompt, answer the `activate` choice for The Grand Spellbook Tower (find by choice `card.code`), auto-answer follow-up prompts with first valid choice, then assert `mapSnapshotToBoard(lastSnapshot).ok === true` and one player-0 card projects into `"p0:field"` (`location "spellTrap"` seq 5 or `location "field"` seq 0 — assert via board zoneId, not raw location). If repro shows a different raw address than hypothesized, record actual shape in test comment and adjust fix target accordingly.
2. **Green** — minimal mapper change (below).
3. **Refactor** — none expected.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| maps a field spell reported at spellTrap sequence 5 into the field zone | snapshot w/ p0 card spellTrap seq 5 | `ok: true`, card `zoneId === "p0:field"` |
| still rejects spellTrap sequences 6 and 7 | snapshot w/ seq 6 (then 7) | `ok: false`, `unsupported_fixed_card` |
| activating a field spell keeps the projected board mappable | programmed spellbook duel, activate tower | board mapping ok, `p0:field` occupied, no thrown `DuelOperationError` |

## Impl steps

- [ ] 1. Write the two unit tests in `tests/unit/duel-field.test.ts`; run `npm run test:unit -- tests/unit/duel-field.test.ts`; confirm first is red.
- [ ] 2. Write `tests/integration/field-spell-activation.test.ts`; run `npm run test:integration -- tests/integration/field-spell-activation.test.ts`; confirm red (board mapping failure or unsupported error). Capture the raw engine address shape it shows.
- [ ] 3. Fix `mapEngineFieldAddress` in `src/battle/field/duel-field-layout.ts`, case `"spellTrap"`: `if (sequence === 5) return supported(\`p${player}:field\`);` before the `> 4` rejection; keep 6/7 unsupported.
- [ ] 4. In `src/battle/worker/protocol/PromptRegistry.ts` `decodeAvailablePlaces`: for the two spellTrap groups, when `sequence === 5` emit `{ player, location: "field", sequence: 0 }` instead of `{ ..., location: "spellTrap", sequence: 5 }` **only if** the integration repro shows a select-place prompt offering that bit; otherwise leave untouched and note it in the commit body. If changed: the stored engine place used for the response must stay the raw decoded one (verify `publicToEngineLocation` round trip in `tests/unit/prompt-registry.test.ts`, test name `field zone place answers the engine with its original address`).
- [ ] 5. Re-run both test files → green. Run full `npm run test:unit && npm run test:integration`.
- [ ] 6. `npm run typecheck && npm run lint`.
- [ ] 7. Manual check: `npm run dev`, start duel with Spellbook deck, activate The Grand Spellbook Tower → field stays mounted, card visible in left Field Zone.

## Outputs

- Files touched: `src/battle/field/duel-field-layout.ts`, possibly `src/battle/worker/protocol/PromptRegistry.ts`, `tests/unit/duel-field.test.ts`, `tests/unit/prompt-registry.test.ts` (conditional), new `tests/integration/field-spell-activation.test.ts`.
- Behavior: `spellTrap` sequence 5 addresses map to physical `p{player}:field`; board mapping survives field-spell activation.
- Signature unchanged: `mapEngineFieldAddress(address: EngineFieldAddress): PhysicalZoneMappingResult` (T2 consumes the integration harness file created here).

## Validation

- [ ] tests pass: `npm run test:unit`, `npm run test:integration`
- [ ] manual check: field spell activation in dev build keeps field mounted
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `fix(field): map field-spell zone addresses (spellTrap seq 5) onto the field zone`
