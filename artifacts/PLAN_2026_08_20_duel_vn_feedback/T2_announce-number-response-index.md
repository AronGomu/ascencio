# T2: ANNOUNCE_NUMBER response index

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** An announce-number prompt is answered with the option's index, so the core stops rejecting the response and killing the duel.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 8.
- This slice: the single-line correctness fix, with a regression test that pins the encoding. T3 then audits every other prompt kind for the same class of mistake.
- Out of scope here: the audit (T3), the replay/recovery dialog (T12/T13), any UI change.
- Assumptions in force: the vendored engine at `vendor/ocgcore-wasm/0.1.2/` is permanently frozen and must not be touched.

## Requirements

- `EngineResponseType.ANNOUNCE_NUMBER` responses carry the **zero-based index** of the chosen option within `message.options`, not the option's numeric value.
- A unit test asserts the index for an option list whose values differ from their indexes (this is what made the bug invisible: an option list of `[1, 2, 3]` answers correctly by accident).
- No other prompt kind changes in this ticket.

## Inputs

- `src/battle/worker/protocol/PromptRegistry.ts` lines 638-654 — the `case EngineMessageType.ANNOUNCE_NUMBER:` block. It currently ends with:
  ```ts
  (ids) => ({
    type: EngineResponseType.ANNOUNCE_NUMBER,
    value: Number(message.options[exactlyOne(ids, bindings).rawIndex]),
  }),
  ```
- `src/battle/worker/engine/engine-constants.ts:106` — `ANNOUNCE_NUMBER: 143` (message), `:129` — `ANNOUNCE_NUMBER: 19` (response).
- `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts:1897` — `OcgResponseAnnounceNumber = { type; value: number }`; `dist/index.js` writes it as `case 19: t.i32(e.value)`, a raw 32-bit write with no mapping. ocgcore validates that integer as an index into its own `select_options` list and emits `MSG_RETRY` when it is out of range.
- Evidence: `/home/aron/Downloads/ygo-duel-diagnostics-a562f5ad6794.json`, trace entries 474-480 — `msg 143` → response `choice-0-select` → `msg 1` (`MSG_RETRY`) → `session_closed:failed`.
- Sibling encoders that already do this correctly: `SELECT_OPTION` (`PromptRegistry.ts:336`, `index: exactlyOne(ids, bindings).rawIndex`) and `SELECT_CHAIN` (`:359`).
- Existing test file to extend: `tests/unit/prompt-registry.test.ts` if present, else create it beside the other unit tests.

## From Depends

- T1 changed documentation only. Nothing in `src/` differs from `main` at the start of this ticket.

## Plan defect found during execution (2026-08-21)

The `Inputs` claim that the encoder still reads `Number(message.options[...rawIndex])` is stale. Commit `6d865e8` (2026-08-20 16:47, already an ancestor of `5023c96`) landed the `rawIndex` encoder plus a weaker `[1n, 2n, 3n]` regression test, under an e2e-titled commit message. Steps 3 and 5 were therefore already satisfied on `main`; they are checked against the shipped code rather than a new edit, and step 2's red was reproduced by temporarily restoring the pre-`6d865e8` line, capturing `expected { type: 19, value: 8 } to deeply equal { type: 19, value: 2 }`, then restoring the file byte-identically (`git diff -- src` empty before the step 4 comment edit).

## TDD

1. **Red** — add `announce-number answers with the option index, not its value` to the prompt-registry unit test, feeding options `[4n, 6n, 8n]` and selecting the third binding; assert `{ type: EngineResponseType.ANNOUNCE_NUMBER, value: 2 }`.
2. **Green** — replace `Number(message.options[...rawIndex])` with `exactlyOne(ids, bindings).rawIndex`.
3. **Refactor** — none.

## Test plan

| Test                                                            | Input                                                            | Expect                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------- |
| `announce-number answers with the option index, not its value`  | `options: [4n, 6n, 8n]`, choose the binding whose label is `"8"` | response `{ type: 19, value: 2 }` |
| `announce-number still labels choices with the announced value` | same message                                                     | binding labels are `"4","6","8"`  |
| `announce-number rejects a multi-selection`                     | two choice ids                                                   | throws (via `exactlyOne`)         |

## Impl steps

- [x] 1. Open `src/battle/worker/protocol/PromptRegistry.ts` and find `case EngineMessageType.ANNOUNCE_NUMBER:` (line ~638). Criterion: the case block is quoted in the report with its current line numbers.
- [x] 2. Add the failing test described above to the prompt-registry unit test file; run `npx vitest run tests/unit/prompt-registry.test.ts` and confirm it fails with `value: 8`. Criterion: captured vitest output naming `value: 8` while the value-encoding line is in place.
- [x] 3. Change the answer function body to `({ type: EngineResponseType.ANNOUNCE_NUMBER, value: exactlyOne(ids, bindings).rawIndex })`. Criterion: that exact expression is the shipped body on `main`.
- [x] 4. Add a comment above the return recording that ocgcore reads this field as an index into `core.select_options`, with a pointer to `vendor/ocgcore-wasm/0.1.2/dist/index.js` `case 19`. Criterion: the comment names the index semantics and the vendored writer.
- [x] 5. Re-run the test and confirm it passes. Criterion: `npx vitest run tests/unit/prompt-registry.test.ts` exits 0.
- [x] 6. Write `docs/ADR/046_ADR_engine_response_encoding_contract.md`: context (one mis-encoded field killed a duel with an undiagnosable error), decision (every response encoder states in a comment whether the engine reads that field as an index, a raw value or a card code, and each is pinned by a unit test), consequences, and the audit that T3 performs. Criterion: the file is tracked by git and its decision list covers comment + test + `rawIndex`.
- [x] 7. Append a `## T2 announce-number-response-index` section to `artifacts/manual_test_checklist.md`. Criterion: the section exists with unchecked `- [ ]` boxes and no other ticket's section is touched.

## Outputs

- Files touched: `src/battle/worker/protocol/PromptRegistry.ts`, `tests/unit/prompt-registry.test.ts`, `docs/ADR/046_ADR_engine_response_encoding_contract.md` (new).
- Behaviour change: announce-number prompts (for example a level or ATK declaration) no longer abort the duel.
- Migration/config: none.

## Validation

- [x] `npx vitest run tests/unit/prompt-registry.test.ts` passes — 13 passed (13)
- [x] `npm run test:integration` passes (no existing duel replay regresses) — 12 files, 32 tests passed
- [x] `npm run check:headless` passes — EXIT=0
- [ ] manual: start a duel, reach an announce-number effect, confirm no error panel. Criterion: deferred to a human — steps written into `artifacts/manual_test_checklist.md`; the box stays unchecked until a human runs them.
- [x] app functional — the worker still answers every other prompt kind unchanged. Criterion: no `src/` diff outside the ANNOUNCE_NUMBER case and `npm run check:headless` green.
- [x] commit msg draft: `fix(duel-protocol): announce-number answers with the option index the core expects`. Shipped as `c204dbb` with one verb amended — `fix(duel-protocol): pin the announce-number answer to the option index the core expects` — because the encoder already answered with the index before this commit (see the plan-defect note above), so the draft subject would have claimed a change the diff does not make.
