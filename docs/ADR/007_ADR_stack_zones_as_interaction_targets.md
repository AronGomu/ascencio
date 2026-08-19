# ADR-007: Stack Zones Are Interaction Targets

> Status: accepted; planned
> Decided: 2026-08-09
> Owners: field interaction architecture
> Plan: [`../../artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`](../../artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md) — T6, T8, T11

## Context

`resolvePromptChoiceBoardTarget` maps a prompt choice to a board target by looking its card up in `board.cards`. `board.cards` only holds hand cards and cards in monster, spell/trap and field slots. Deck, extra deck, graveyard and banished contents live in `board.stacks`, and `publicCards(player, location)` in `card-mapping.ts` returns `undefined` for `deck` and `extra` outright.

Every choice sourced from a pile therefore resolves to `nonField`, lands in `globalChoices`, leaves `spec.fieldCapable` false, and `promptSurface` opens the modal `PromptDialog`. That is why a graveyard activation shows up as a full-screen "Choose a chain response" dialog whose only usable button is `Pass`: the activation is in the prompt, but nothing on the field can express it.

`BoardTargetId` has always admitted `` `stack:${PhysicalZoneId}` ``. Nothing produced one.

A second obstacle sits behind the first. `sanitizeChoice` strips a choice down to `{ id, label, action, value?, toggleState?, allocationMaximum? }`, so the card it acts on is gone by the time the field sees it. `PromptChoice.card.instanceId` is no help either — `toPromptCard` synthesises `` `p${controller}-l${location}-s${sequence}` ``, which is an address, not the projector's instance id. The only reliable join between a choice and a card inside a pile is the triple `(controller, location, sequence)`.

## Decision

1. `PromptChoiceBoardTargetResolution` gains a third member, `{ kind: "stack"; targetId: \`stack:${PhysicalZoneId}\` }`, returned for any choice whose `card.location` is `deck`, `extra`, `graveyard` or `banished`.
2. `ActiveInteractionSpec` gains `stackChoices: ReadonlyMap<BoardTargetId, readonly InteractionChoice[]>`, built exactly like `cardChoices`.
3. `InteractionChoice` gains an optional `cardAddress: { controller; location; sequence }`, populated from the prompt's own card address. Matching is done on the triple, never on an id.
4. A stack with entries in `stackChoices` wears the same orange legality halo as an actionable card or zone.
5. A stack is never a direct choice trigger. Clicking it opens a list of its contents; the action is taken on a specific card in that list.
6. `spec.fieldCapable` starts ignoring `stackChoices` and starts counting them only once the list dialog exists. The two-step is deliberate: flipping `fieldCapable` before there is a way to act on a pile would hide the modal that is currently the only way to answer, and deadlock the duel.

## Alternatives rejected

- **Special-case pile choices in the field component.** Leaves `card-mapping.ts` correct-looking and wrong, and duplicates the location→zone mapping in a second place that will drift.
- **Mount pile contents as `board.cards`.** Forty deck cards and fifteen extra-deck cards per player would enter the spatial navigation graph, the drag hit-test and the DOM feedback controller, all of which assume one card per physical zone.
- **Match choices to cards by `instanceId`.** The prompt's instance id is a synthetic address string from the protocol layer and does not equal the projector's. It would appear to work for hand cards and silently fail for piles.
- **Make a stack fire its single choice directly.** A graveyard holding two activatable cards has no single choice, and the fallback would be arbitrary.

## Consequences

- `promptSurface` stops routing graveyard and banished activations to the modal, which is what lets ADR-010's inline chain response work at all.
- `FieldBoard`'s `actionableTargets` grows stack targets, so keyboard roving focus reaches a pile.
- `DuelField.targetSelections` still iterates only `cardChoices` and `zoneChoices`: a pile is never "selected", only opened.
- `InteractionChoice` grows one optional field. Every existing consumer ignores it.
- Any future prompt kind that targets pile contents (a graveyard `selectCard`, for example) inherits the halo and the list for free.
</content>
