# ADR-030: Private Pile Tops Render Face-Down

> Status: accepted; planned
> Decided: 2026-08-16
> Owners: field presentation architecture
> Plan: [`../../artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`](../../artifacts/PLAN_2026_08_16_duel_feedback_round_4.md) — T4

## Context

Stack tiles (`createStacks` in `board-view-model.ts`) showed the top public card for every pile except the deck. The player's own extra deck therefore showed its top card face-up — but the opponent's showed a back. Product rule: face-up top = the zone is public (both players may inspect); the extra deck is private (only its owner browses it), symmetry with the deck. Your own private zones still render face-down on the board; browsing the list is where the owner sees inside.

## Decision

1. `deck` and `extra` stacks never expose `topCardCode`/`topCardLabel`, either seat. `graveyard`/`banished` keep the top public card face-up.
2. Non-empty private stacks render the card-back art in `StackControl` (new `cardBackUrl` prop) so both piles read as physical face-down stacks, matching the opponent's.
3. Accessible labels drop the "top card X" suffix for private piles (falls out of the model change).
4. Owner access is unchanged: clicking the pile still opens the browse list with full own-side identity.

## Alternatives rejected

- Show own extra top face-up as a convenience: breaks the public/private zone language the rest of the board teaches; feedback explicitly rejects the exception.
- Hide face-up banished/GY tops too: those piles are public knowledge; hiding invents secrecy.
