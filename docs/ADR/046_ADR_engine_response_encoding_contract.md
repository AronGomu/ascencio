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
