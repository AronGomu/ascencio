# ADR-046: Engine Response Encoding Contract

> Status: accepted
> Decided: 2026-08-20
> Owners: duel worker protocol
> Shipped: `6d865e8` (encoder), and the commit carrying this file (contract + pinning tests)
> Feedback: [`../../feedback-duel.md`](../../feedback-duel.md) — item 8

## Context

A duel died mid-game with `ocgcore rejected the previous response` and nothing else. The diagnostics trace, entries 474-480, reads: message `143` (`ANNOUNCE_NUMBER`) → our response → message `1` (`MSG_RETRY`) → `session_closed:failed`.

The cause was one field. `PromptRegistry.ts` answered announce-number with the **announced value**:

```ts
value: Number(message.options[exactlyOne(ids, bindings).rawIndex]);
```

ocgcore reads that field as an **index into the option list it just announced**: it substitutes `options[value]` and retries when the integer is out of range. So the wrong encoding failed in two different ways, and only one of them was visible. Announcing `[4, 6, 8]` and picking `8` sent `8` into a three-element list — `MSG_RETRY`, duel over. Announcing `[4, 6, 8]` and picking `4` sent `4`, also out of range. Announcing `[1, 2, 3]` and picking `1` sent `1`, which *is* a valid index — the core silently announced `2`. Only an option list whose values equal their own positions, `[0, 1, 2]`, answers correctly by accident.

The failure mode is what makes this ADR necessary rather than a one-line fix. Each `OcgResponse*` field is one of: an index into a list the message just sent, a raw game value, a card code, or a bitmask. The TypeScript types name none of that — `{ type; value: number }` is the same shape either way — and the vendored writer emits the integer raw (`vendor/ocgcore-wasm/0.1.2/dist/index.js`, `case 19: t.i32(e.value)`). A wrong choice type-checks, passes review, and surfaces only as an undiagnosable mid-duel abort.

The rest of the file already got this right by habit: `SELECT_OPTION` and `SELECT_CHAIN` both send `rawIndex`. Habit is not a contract.

## Decision

1. Every response encoder in `src/battle/worker/protocol/PromptRegistry.ts` carries a comment naming the field's semantics — **index**, **raw value**, **card code** or **bitmask** — and cites the vendored source that settles it: `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts` for the shape, the writer switch in `dist/index.js` for what actually goes on the wire.
2. Every prompt kind has a unit test pinning its exact response object, built from a message whose **values differ from their positions** — the only shape of fixture that can catch this class.
3. `ANNOUNCE_NUMBER` answers with `rawIndex`.

The vendored engine stays frozen. This ADR changes only how we speak to it.

## Consequences

- The remaining encoders are not pinned yet. `6d865e8` fixed one prompt kind and audited none, so a follow-up sweep still has to apply rules 1 and 2 to every other `case` in `buildRawEnginePrompt`. The sweep is mechanical and one-off; the tests it leaves behind are permanent.
- A future prompt kind is not "done" until its encoding test exists.
- Fixtures diverge value from position on purpose. `[0, 1, 2]` would pass under either encoding and is therefore worthless here; `[4, 6, 8]` fails loudly, because no index into a three-option list can be `8`.
- The comments are load-bearing documentation, not decoration: the type system cannot express the difference this ADR exists to record.

## Audit result

This section is the sweep the first Consequence above anticipated, and supersedes it: every encoder is now pinned. It was carried out against `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts` for the response shapes and the `ce()` response writer in the sibling `dist/index.js` for what actually reaches the wire. "Writer case n" below means `case n:` in that writer. The pinning tests are `describe("response encoding")` in [`../../tests/unit/prompt-registry.test.ts`](../../tests/unit/prompt-registry.test.ts); the encoders are `buildRawEnginePrompt` in [`../../src/battle/worker/protocol/PromptRegistry.ts`](../../src/battle/worker/protocol/PromptRegistry.ts).

**No second bug.** `ANNOUNCE_NUMBER` remains the only encoder that disagreed with the vendored contract. Twenty-one message cases were read; twenty-one agreed after that one fix. The value of the sweep is the pin, not a second repair: each of the twenty new tests was checked by deliberately breaking its encoder and confirming that its own test — and only its own test — went red.

| Message | Response | Writer case | Field | Semantics |
| --- | --- | --- | --- | --- |
| `SELECT_BATTLECMD` | `SELECT_BATTLECMD` | 0 | `action` / `index` | raw action enum / **index** into the array that action names (`chains`, `attacks`); `null` for `to_m2` and `to_ep`. Packed as `action \| index << 16` |
| `SELECT_IDLECMD` | `SELECT_IDLECMD` | 1 | `action` / `index` | raw action enum / **index** into that action's own array, never the merged choice list |
| `SELECT_EFFECTYN` | `SELECT_EFFECTYN` | 2 | `yes` | boolean |
| `SELECT_YESNO` | `SELECT_YESNO` | 3 | `yes` | boolean |
| `SELECT_OPTION` | `SELECT_OPTION` | 4 | `index` | **index** into `message.options` |
| `SELECT_CARD` | `SELECT_CARD` | 5 | `indicies` | **indexes** into `message.selects`; `null` cancels |
| `SELECT_CHAIN` | `SELECT_CHAIN` | 8 | `index` | **index** into `message.selects`; `null` passes |
| `SELECT_PLACE` | `SELECT_PLACE` | 10 | `places` | **raw** engine place addresses, echoed back unchanged |
| `SELECT_POSITION` | `SELECT_POSITION` | 11 | `position` | **raw** position bit, not the offered position's ordinal |
| `SELECT_TRIBUTE` | `SELECT_TRIBUTE` | 12 | `indicies` | **indexes** into `message.selects`; `null` cancels |
| `SORT_CHAIN` | `SORT_CARD` | 15 | `order` | **indexes** into `message.cards`; `null` declines |
| `SELECT_COUNTER` | `SELECT_COUNTER` | 13 | `counters` | **raw** counts, one slot per `message.cards` entry in message order |
| `SELECT_SUM` | `SELECT_SUM` | 14 | `indicies` | **indexes** into `message.selects` alone; `selects_must` is implicit |
| `SELECT_DISFIELD` | `SELECT_DISFIELD` | 9 | `places` | **raw** engine place addresses |
| `SORT_CARD` | `SORT_CARD` | 15 | `order` | **indexes** into `message.cards`; `null` declines |
| `SELECT_UNSELECT_CARD` | `SELECT_UNSELECT_CARD` | 7 | `index` | **index** into `select_cards` followed by `unselect_cards` as one list; `null` for finish and cancel alike |
| `ROCK_PAPER_SCISSORS` | `ROCK_PAPER_SCISSORS` | 20 | `value` | **raw** hand value — 1 scissors, 2 rock, 3 paper — one more than the choice's index |
| `ANNOUNCE_RACE` | `ANNOUNCE_RACE` | 16 | `races` | **bitmask**: the writer ORs the array into one `u64` |
| `ANNOUNCE_ATTRIB` | `ANNOUNCE_ATTRIB` | 17 | `attributes` | **bitmask**: the writer ORs the array into one `u32` |
| `ANNOUNCE_CARD` | `ANNOUNCE_CARD` | 18 | `card` | raw **card code**; the candidate list is ours and the engine never saw it |
| `ANNOUNCE_NUMBER` | `ANNOUNCE_NUMBER` | 19 | `value` | **index** into `message.options` — the one this ADR was written for |

The sweep also turned up two places where the vendored contract does not settle a question. Neither is a live defect and neither was changed here; both are recorded so the next reader does not have to rediscover them.

1. **`SelectFieldPlace.location` is wider than the wire.** The type admits every `OcgLocation`, including `FZONE` (256) and `PZONE` (512), but writer cases 9 and 10 emit the field as `i8`, which truncates both to 0. Our `publicToEngineLocation` can return either, so the hazard is real in the type; it is unreachable in practice because `decodeAvailablePlaces` only ever produces monster and spell/trap places. A future field-zone or pendulum-zone prompt would hit it silently.
2. **`SORT_CARD.order` has no documented direction.** The type is `number[] | null` with no statement of whether an entry is a source index or a destination sequence. The encoder sends a permutation of `message.cards` indexes in the player's chosen order, and the test pins that behaviour — but it pins *our* behaviour, not a vendored fact, and is the one row in the table above that a vendored source cannot fully back.
