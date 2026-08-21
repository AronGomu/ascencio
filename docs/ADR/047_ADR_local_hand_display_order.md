# ADR-047: Local hand display order

Status: accepted · 2026-08-20 · Plan: `artifacts/PLAN_2026_08_20_duel_vn_feedback.md` — T10

## Context

Feedback: a searched card should land at the right end of the hand. It does not, and the hand also reshuffles under the player.

Not a UI ordering bug. After a search ocgcore emits `MSG_SHUFFLE_HAND`; `DuelStateProjector` adopts that order and `resequence`s the hand, and `HandBand` renders by `card.sequence`. The engine's shuffle is the display order.

The engine shuffles for a reason: it hides from the **opponent** which hand slot a searched card went to. That reason does not apply to the hand's owner, who watched the search resolve and knows every card they hold. Every mainstream client shows the searcher their own fetched card at the end of the hand.

## Decision

The local player's hand renders in **arrival order**.

- Each card gets a `displayOrder` when it enters a hand, from a per-player monotonic counter.
- `MSG_SHUFFLE_HAND` still reorders the engine-facing hand; it does not touch `displayOrder`.
- `HandBand` sorts by `displayOrder` for player 0 and by `sequence` for the opponent.
- Responses keep using engine indexes. The display order never reaches a choice payload.

## Consequences

- A searched card appears rightmost; the rest of the hand does not move.
- No information leak: the opponent's hand is backs only and keeps engine order, and the local player learns nothing they did not already know.
- Two orders now exist per hand. The rule that keeps them from being confused: `sequence` addresses the engine, `displayOrder` addresses the eye. A test asserts a choice made on the visually-last card still carries the engine's index.
- A future manual drag-to-reorder of your own hand has a field to write to.
