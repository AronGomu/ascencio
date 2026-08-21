# ADR-008: Projected Deck Order And Reveal Tracking

> Status: accepted; planned
> Decided: 2026-08-09
> Owners: worker projection architecture
> Commit: `b5702e2` — T9, T10

## Context

The product asks for a deck you can open and inspect: one entry per remaining card, face-down by default, and — this is the sharp part — *"whenever you update information that reveals the position of a card within the deck … that information should become public, just like a visible card in the graveyard."* Excavating the top three and putting them back must leave the player knowing what sits where.

`DuelStateProjector` models a deck as `MutablePlayer.deckCount`, a number. There is no list, no order and no identity. `stackCollection(player, "deck")` returns `[]` for that reason.

The engine already sends everything needed and the worker already routes it. `message-classification.ts` classifies `MSG_CONFIRM_DECKTOP` (30), `MSG_CONFIRM_CARDS` (31), `MSG_SHUFFLE_DECK` (32), `MSG_SWAP_GRAVE_DECK` (35), `MSG_REVERSE_DECK` (37), `MSG_DECK_TOP` (38) and `MSG_CONFIRM_EXTRATOP` (42) as `"event"`, so they all reach `apply()` — where they fall into `default: break;`.

The obvious model — mirror `list_main` and index reveals by the engine's deck `sequence` — carries a factual risk we refuse to take on faith: whether ocgcore's deck sequence 0 is the top or the bottom of the pile. Getting that backwards would not crash anything. It would quietly show the player the wrong card at the wrong position, which is worse than showing nothing.

## Decision

1. `PublicPlayerState` gains `deck: readonly PublicCard[]`, length always equal to `deckCount`, **index 0 = top of the deck**, `sequence === index`.
2. The projector does **not** model deck contents. It keeps `deckReveals: Map<number, CardCode>` per player, keyed by **offset from the top**, and synthesises the `deck` array at snapshot time from `deckCount` plus that map.
3. Only three messages write reveals, and none of them needs an engine deck sequence:
   - `DRAW` — the drawn cards leave the top, so every surviving reveal shifts down by `drawn.length`.
   - `CONFIRM_DECKTOP` — `cards[i]` is the `i`-th card from the top. Reveal offsets `0..n-1`.
   - `DECK_TOP` — `count` is the offset from the top. Reveal that one offset.
4. Anything that disturbs the order clears every reveal for that player: `SHUFFLE_DECK`, `SWAP_GRAVE_DECK`, `REVERSE_DECK`, and any `MOVE` whose `from` or `to` is a deck.
5. `CONFIRM_CARDS` is ignored for deck slots. Its entries carry engine deck sequences, which is exactly the ambiguity this ADR is avoiding.
6. A `CONFIRM_DECKTOP` whose entries are not *all* deck-located and owned by `message.player` is skipped whole rather than partially applied.
7. Reveals with an offset at or past `deckCount` are pruned after every message.
8. A revealed slot projects `position: "faceUpAttack"`, `faceUp: true` and its `code`. An unrevealed one projects `position: "faceDownAttack"`, `faceUp: false` and no `code`.
9. The synthesised slots are **not** added to `allVisibleCards`, so the existing 256-instance and duplicate-instance guards in `snapshot()` stay measuring real cards.

## Alternatives rejected

- **Mirror `list_main` and index by engine sequence.** Requires knowing the top/bottom convention. Every write path (`MOVE`, `CONFIRM_CARDS`) would have to translate it, and a wrong constant silently lies to the player.
- **Calibrate the convention with a live-engine test.** Possible, but it makes a correctness property depend on a preset deck containing an excavate effect, and it buys nothing the offset model does not already give.
- **Track reveals only for the local player's own deck.** The player legitimately learns opponent deck positions from public excavates too; suppressing them would be inventing hidden information in the other direction.
- **Emit a presentation event per reveal.** A reveal is state, not narrative. The duel log is already noisy and a reveal has no animation.
- **Skip reveal tracking, show N face-down slots.** Was on the table and explicitly rejected by the product owner.

## Consequences

- The projection may **forget** a reveal (any deck `MOVE` clears the map). It can never **invent** one. That asymmetry is the safety property this design is built around, and any future change must preserve it.
- `EngineMessageType` grows `CONFIRM_DECKTOP`, `SWAP_GRAVE_DECK`, `REVERSE_DECK` and `DECK_TOP`. `CONFIRM_CARDS` is deliberately not added — an unused constant would imply a handler that does not exist.
- The worker/UI contract validator gains a `deck` zone with a length-equals-count assertion, so every fixture that builds a `PublicPlayerState` needs a matching `deck`. A `deckSlots(player, count)` test helper absorbs that.
- `isCardIdentityVisible(viewer, controller, "deck", position)` returns `true` for the viewer's own cards. It must **not** be used to decide whether a deck slot is visible; the consumer reads `faceUp` and `code` instead. This is a live foot-gun and is called out at the call site.
- A deck pile on the board still shows no art: `publicCards.at(-1)` on a deck would be the *deepest* revealed card, not the top one, and item 11 only asked for graveyard and banished.
- Adding a genuine deck-order model later is still possible; it would replace the reveal map without changing `PublicPlayerState`.
</content>
