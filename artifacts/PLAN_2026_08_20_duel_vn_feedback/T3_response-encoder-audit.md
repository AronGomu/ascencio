# T3: Response-encoder audit

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T2
**Commit outcome:** Every prompt kind's response encoding is pinned by a named unit test and documented against the vendored type definitions, so a mis-encoded answer fails a test instead of a duel.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket completes `feedback-duel.md` item 8: the answer chosen was "fix `ANNOUNCE_NUMBER` **plus** audit every response encoder against the vendored types, one unit test per prompt kind".
- This slice: read every `case` in the prompt registry, classify what the engine expects in each response field, fix any that disagree, and freeze all of them with tests.
- Out of scope here: changing prompt _presentation_, adding new prompt kinds, touching `vendor/`.
- Assumptions in force: `vendor/ocgcore-wasm/0.1.2/` is frozen; its `dist/index.d.ts` and the response writer in `dist/index.js` are the authority for what a field means.

## Requirements

- Each `case EngineMessageType.*` in `src/battle/worker/protocol/PromptRegistry.ts` that returns a response has a unit test asserting the exact response object for a message whose values differ from their indexes.
- Each response encoder carries a one-line comment stating the field's semantics: **index**, **raw value**, **card code**, or **bitmask**.
- Any encoder found to disagree with `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts` is fixed in this ticket, with the disagreement recorded in the test name.

## Inputs

- `src/battle/worker/protocol/PromptRegistry.ts` — the full `case` list. The kinds to cover: `SELECT_BATTLECMD`, `SELECT_IDLECMD`, `SELECT_EFFECTYN`, `SELECT_YESNO`, `SELECT_OPTION`, `SELECT_CARD`, `SELECT_CHAIN`, `SELECT_PLACE`, `SELECT_POSITION`, `SELECT_TRIBUTE`, `SORT_CHAIN`, `SELECT_COUNTER`, `SELECT_SUM`, `SELECT_DISFIELD`, `SORT_CARD`, `SELECT_UNSELECT_CARD`, `ANNOUNCE_RACE`, `ANNOUNCE_ATTRIBUTE`, `ANNOUNCE_CARD`, `ANNOUNCE_NUMBER`, `ROCK_PAPER_SCISSORS`.
- `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts` — `OcgResponse*` types (search `export declare type OcgResponse`).
- `vendor/ocgcore-wasm/0.1.2/dist/index.js` — the response writer; search for `case 19:` to find the switch that serialises each response type, and read the neighbouring cases to see whether a field is written raw (`i32`) or mapped.
- `src/battle/worker/engine/engine-constants.ts` — `EngineMessageType` and `EngineResponseType` numeric maps.
- `tests/unit/prompt-registry.test.ts` — the existing test file this ticket extends.

## From Depends

- T2 changed `case EngineMessageType.ANNOUNCE_NUMBER:` in `PromptRegistry.ts` to answer `{ type: EngineResponseType.ANNOUNCE_NUMBER, value: exactlyOne(ids, bindings).rawIndex }` and added `docs/ADR/046_ADR_engine_response_encoding_contract.md`, whose "Decision" section this ticket satisfies. `tests/unit/prompt-registry.test.ts` already holds the announce-number index test.

## TDD

1. **Red** — for each prompt kind, add a test named `<kind> answers with <index|value|code|bitmask>` built from a message whose option values differ from their positions; run and watch the ones that disagree fail.
2. **Green** — fix each failing encoder to match `dist/index.d.ts` + the writer.
3. **Refactor** — extract a `buildPrompt(message)` helper in the test file if the setup repeats more than three times; keep every assertion explicit.

## Test plan

| Test                                                 | Input                                         | Expect                                            |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `select-option answers with the option index`        | 3 options, choose the last                    | `{ type: 14-equivalent, index: 2 }`               |
| `select-chain answers with the chain index or null`  | 2 chain entries + pass                        | index for a chain entry, `null` for pass          |
| `select-card answers with engine card indexes`       | 4 selectable cards, choose #2 and #4          | indexes `[1, 3]`                                  |
| `select-place answers with the engine place address` | one legal place                               | the address the message offered, unchanged        |
| `select-position answers with the position bit`      | offered positions bitmask                     | the single chosen position bit, not its ordinal   |
| `select-counter answers with per-card counts`        | 2 cards, 3 counters                           | counter array aligned to the message's card order |
| `select-sum answers with selected indexes`           | sum selection fixture from `sum-selection.ts` | indexes, not values                               |
| `announce-race/attribute answer with a bitmask`      | available bitmask with 3 bits                 | the selected bits OR-ed, not their ordinals       |
| `announce-card answers with the card code`           | candidate list                                | the candidate's `code`                            |
| `announce-number answers with the option index`      | `[4n, 6n, 8n]`, choose `8`                    | `value: 2` (already green from T2)                |
| `rock-paper-scissors answers 1, 2 or 3`              | choose Rock                                   | `value: 2`                                        |

## Impl steps

- [ ] 1. List every `case EngineMessageType.` line in `PromptRegistry.ts`: `grep -n "case EngineMessageType\." src/battle/worker/protocol/PromptRegistry.ts`.
- [ ] 2. For each, open the matching `OcgResponse*` type in `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts` and the matching `case <n>:` in `dist/index.js`; write down index vs value vs code vs bitmask.
- [ ] 3. Add one test per kind from the table to `tests/unit/prompt-registry.test.ts`, using values that differ from positions.
- [ ] 4. Run `npx vitest run tests/unit/prompt-registry.test.ts`; record every failure.
- [ ] 5. Fix each failing encoder in `PromptRegistry.ts`, one commit-local change at a time, re-running the test after each.
- [ ] 6. Add the semantics comment above every encoder's return, in the form `/* engine reads this as an index into the message's own list */`.
- [ ] 7. Append an "Audit result" section to `docs/ADR/046_ADR_engine_response_encoding_contract.md` listing each prompt kind and its field semantics, plus any second bug the audit found.
- [ ] 8. Run `npm run test:integration` to confirm no recorded duel replay changed behaviour.

## Outputs

- Files touched: `src/battle/worker/protocol/PromptRegistry.ts`, `tests/unit/prompt-registry.test.ts`, `docs/ADR/046_ADR_engine_response_encoding_contract.md`.
- Behaviour change: any additional mis-encoded prompt kind stops aborting duels.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/unit/prompt-registry.test.ts` passes with one test per prompt kind
- [ ] `npm run test:integration` passes
- [ ] `npm run check:headless` passes
- [ ] app functional — a full duel still plays start to finish
- [ ] commit msg draft: `test(duel-protocol): pin every response encoding against the vendored contract`
