# ADR-014: Public Knowledge For Face-Down Cards

> Status: accepted; planned
> Decided: 2026-08-10
> Owners: worker projection and privacy architecture
> Plan: [`../../artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`](../../artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md) — T6

## Context

`DuelStateProjector` currently equates current face visibility with local-viewer knowledge. When an opponent card crosses visible→hidden, `#move`/`#changePosition` rotate its public instance id and delete code. That prevents illicit correlation, but also forgets a face-up monster merely turned face-down and a public graveyard card moved directly into a set field slot.

Position visibility and known identity are different. ADR-008 already uses conservative, projector-attested knowledge for deck offsets. This ADR applies the same safety asymmetry to trackable physical field cards. ADR-007/list/preview consumers must read projection; they must never infer identity from raw engine payload.

## Decision

1. `PublicCard.code` presence means the local viewer knows identity. No duplicate `identityVisible` field is added.
2. Face orientation remains represented by `position`/`faceUp`. A known face-down card keeps back art on board while preview/accessibility may use code.
3. Preserve code and instance id when a currently known/public card moves directly from graveyard, face-up banished or face-up field to a face-down fixed field slot.
4. Preserve code/id when a face-up fixed card turns face-down in the same slot.
5. `CONFIRM_CARDS` addressed to player 0 creates one-use, non-deck projector reveal tokens keyed by controller/location/sequence/code. Exact matching move may carry that confirmed knowledge into a face-down fixed slot; player-1 recipient or mismatch grants nothing.
6. Never grant knowledge from nonzero raw code alone on hidden hand/deck→set, hidden face-down summon, or unknown face-down position message.
7. Once a known face-down card changes address, rotate id and clear carried code before applying destination. A public destination may establish a fresh id/code from its public message.
8. Return to hand/deck/extra clears correlation. Opponent hidden-hand shuffle clears stored hidden ids/codes. `SHUFFLE_SET_CARD` applies its from→to permutation but rotates/clears affected known opponent set cards.
9. Pending reveal tokens are checkpointed but expire on matching/mismatched source move, resequencing move, shuffle, new turn/phase, or any uncertainty. Deck entries stay under ADR-008.
10. Projected worker-event validation permits code on opponent face-down `monsters`/`spellsAndTraps` only; it still rejects concealed code in deck/hand/extra/banished and in prompt cards.
11. UI presentation separates `identityKnown` from `faceVisible`: carry known code for preview; render back/hidden orientation while face-down.
12. Unknown defaults hidden. A conservative miss is allowed; invented knowledge is not.

## Transition matrix

| Transition | Identity result |
| --- | --- |
| public GY → face-down fixed field | keep |
| face-up banished → face-down fixed field | keep |
| face-up field → face-down same slot | keep |
| public face-up field move → face-down fixed slot | keep |
| player-0 `CONFIRM_CARDS` exact hidden address/code → matching face-down set | keep |
| player-1 confirm, mismatch, or raw code without confirm | unknown |
| hidden opponent hand/deck → set/summon | unknown |
| known face-down card → any other address | clear/rotate |
| known card → hand/deck/extra | clear/rotate |
| shuffled opponent hidden hand/set cards | clear/rotate |
| face-down → face-up same slot | retain/freshly public |

## Reveal-token boundary

Pinned adapter contract is `OcgMessageConfirmCards { player, cards: { code, controller, location, sequence }[] }`. `player` is reveal recipient. Round 3 accepts only recipient 0, ignores deck entries, stores exact one-use tokens, and clears them aggressively. Hidden `MOVE.card` never establishes knowledge without a matching token. Integration fixtures must confirm player/address ordering; failure tightens/clears tracking, never broadens it.

## Alternatives rejected

- **Keep code but gate every UI on `faceUp`.** Preserves data while still breaking preview and invites consumer drift.
- **Track by code.** Duplicate copies make correlation unsafe.
- **Trust every raw MOVE/POSITION_CHANGE code.** Engine is omniscient; projection is privacy boundary.
- **Retain id across hidden-zone moves indefinitely.** Reused slots/shuffles can identify the wrong physical card.
- **Expose face art on board.** Known identity does not turn a set card face-up.

## Consequences

- Public worker contract semantics widen without shape change.
- Board/list/preview consumers trust projector-attested code and keep orientation separate.
- Existing blanket face-down privacy validator needs a fixed-field exception plus regression tests.
- Checkpoint/restore naturally preserves knowledge because it remains on `MutableCard`.
- ADR-008 deck reveal map remains independent; field-card knowledge never identifies deck slots.
