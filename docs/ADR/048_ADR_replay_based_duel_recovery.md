# ADR-048: Replay-based duel recovery

Status: accepted · 2026-08-20 · Commit: `9d8b8a7` — T12, T13

## Context

A rejected response ends the duel. The player gets an error panel, a diagnostics download, and a restart — losing a game that was, up to one message ago, entirely valid.

Feedback asks for a button that restores the last non-bugged state, landing on "the last decision where the player had agency".

The vendored core (`ocgcore-wasm@0.1.2`, permanently frozen) exposes no state snapshot or duplicate call. There is nothing to save and reload.

What does exist: the worker's trace already records the seed, the deck selection, the snapshot id and **every prompt and response in order**, marking opponent responses with `opponentReason`. `tests/integration/programmed-duel.test.ts` already replays a persisted response log against a fixed seed with no policy fallback. The mechanism is built; it was only ever pointed at tests.

## Decision

Recovery is a **deterministic replay**, not a snapshot restore.

- Build a restore plan from the trace: the recorded seed, the deck selection, the responses in order, and a stop point.
- The stop point is the **last human response** — the last decision the player owned. Opponent responses before it are replayed verbatim, so the position is reproduced exactly rather than re-decided by the policy.
- Replay creates a fresh session and feeds recorded responses through the live response path. The opponent policy resumes only past the stop point.
- Restore is offered whenever the trace holds at least one human response, for **any** fatal duel error — the replay is generic, so there is no error class it cannot attempt.
- No human response recorded → no Restore button; the dialog offers download plus restart.
- A failed replay is a typed failure that leaves the original error visible and the report downloadable.

## Consequences

- Recovery costs a full replay of the duel so far. For a duel of a few hundred messages this is milliseconds; it grows linearly and is bounded by the duel's own length.
- Exactness comes from determinism: same seed, same responses, same core, same position. This is the same property the reproducible-build and programmed-duel suites already depend on.
- The trace must stay in memory for the session — it already does, because the diagnostics download needs it.
- If the underlying bug is unfixed, restoring to the same prompt can fail again. Accepted: the dialog stays reachable, and the player can take a different line from their own decision point.
- This is recovery, not undo. It is reachable from the error dialog only; a general in-duel undo would be a separate decision with rules-integrity questions this ADR does not answer.
