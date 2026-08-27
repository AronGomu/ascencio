# ADR-057: Hand activation moves to a drop zone, and every single-choice drag becomes cancellable

> Status: accepted; planned
> Decided: 2026-08-27
> Owners: battle (duel field, hand)
> Relates: ADR-005 (optimistic drag placement), ADR-007 (stack zones as interaction targets)

## Context

`DuelField.svelte` drives a hand-card drag through two shared functions. `placementZoneCandidates(action, board)` (`src/battle/field/placement-candidates.ts:35`) names the physical zones a choice's `action` may land on and then filters out any that already carry a card — `board.cards.map((card) => card.zoneId)` built into an occupancy set at `placement-candidates.ts:40`, applied with `!occupied.has(zoneId)`. `activate` and `setSpellTrap` both route through the spell/trap row (`placement-candidates.ts:52-54`), so an activate drag is candidate-less the moment all five zones are full — a hand effect with no board footprint still loses its only drop target.

On release, `endCardDrag` (`DuelField.svelte:825`) resolves the dropped zone to a set of choices via `dropChoicesForZone(zone, choices)` (`src/battle/app/prompts/drop-target.ts:39`), which — for a spell/trap zone — orders `activate` ahead of `setSpellTrap` (`drop-target.ts:19`). `DuelField.svelte:850` then branches on the result count: more than one choice opens `DropConfirmDialog` (`dropConfirm = { card, zone, choices }`, `DuelField.svelte:856`); exactly one dispatches `chooseChoice` immediately (`DuelField.svelte:862-863`), with no confirm step, regardless of whether that one choice is `activate`, `summon`, or `setSpellTrap`.

Activation from hand is also reachable as a chip: `CardActionChips.svelte` renders one button per `InteractionChoice`, `variant="list"` relabelling an `activate` choice to "Activate effect" (`CardActionChips.svelte:82-84`). It is consumed by `CardControl.svelte` (card hover), `HandZoomOverlay.svelte` (hand zoom), and `ZoneListEntryTile.svelte` (keyboard-pinned menu) alike — the same component, same choice set, on every surface today.

Owner feedback from the 2026-08-27 round asked for a dedicated activation drop zone for hand cards, and asked that a drag resolving to activation be cancellable rather than committing on release.

## Decision

1. A dashed drop zone, `data-cy="hand-activation-drop-zone"`, renders to the left of the hand band while a hand card with at least one `activate` choice is being dragged. It is absent for a card whose choices contain no `activate`.
2. The zone's availability is gated on activate-choice existence only, never on zone occupancy. It does not route through `placementZoneCandidates`, whose spell/trap row is occupancy-filtered (`placement-candidates.ts:40`) — a full backrow must not make a hand effect unreachable.
3. Any drag-and-drop that resolves to exactly one `activate` choice opens `DropConfirmDialog` instead of dispatching `chooseChoice` immediately, so activation is always cancellable. This applies both to a drop on the new activation zone and to a drop on a spell/trap zone that resolves to a lone `activate` choice. Non-activate single choices (`summon`, `setMonster`, `specialSummon`, `setSpellTrap`) keep the existing immediate-dispatch path (`DuelField.svelte:862-863`) unchanged.
4. `activate` choices are filtered out of the chip set on pointer hover surfaces — `CardControl.svelte` and `HandZoomOverlay.svelte` — but kept in the keyboard-pinned menu (`ZoneListEntryTile.svelte`). Drag is pointer-only; removing the chip from the pinned menu as well would leave activation keyboard-unreachable on a multi-action hand card.

## Consequences

- Two activation paths now exist: pointer drags to the zone, keyboard uses the pinned chip. A newcomer reading only the pointer surfaces would "fix" the asymmetry by deleting the chip everywhere — that deletion is the accessibility regression clause 4 forbids.
- A single-choice `activate` drag now costs an extra confirm click. A spell that used to resolve in one drop-and-release gesture (`DuelField.svelte:862-863`, pre-decision) now stops at `DropConfirmDialog` every time. That friction lands on the common case — most hand spells have exactly one activate choice — in exchange for making the gesture cancellable.
- `CardActionChips` keeps a single implementation across all three surfaces (`CardControl.svelte`, `HandZoomOverlay.svelte`, `ZoneListEntryTile.svelte`); only the `choices` passed in from the pointer-hover call sites narrow to exclude `activate`.

## Alternatives rejected

- **Keep the chip as the only activation path.** Rejected by the owner directly; a chip button gives no cancel opportunity and the 2026-08-27 feedback round asked for a drop zone.
- **Remove the `activate` chip from every surface, including the pinned menu.** Breaks keyboard-only activation on a card with more than one choice, since drag has no keyboard equivalent.
- **Gate the activation zone through `placementZoneCandidates`.** That function's spell/trap branch is occupancy-filtered (`placement-candidates.ts:40`); a full backrow would silently remove the only route to a hand effect that never occupies a zone.
- **Open `DropConfirmDialog` on every single-choice drop, including summon and set.** Adds a confirm click to the common gesture (playing a monster or setting a card) to solve a problem specific to activation; rejected in favor of confirming only the `activate` case.
