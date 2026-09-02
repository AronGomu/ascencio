# ADR-067: Hover chips regain the Activate action

> Status: accepted; planned
> Decided: 2026-09-02
> Owners: battle (duel field, hand)
> Amends: ADR-057 §4 (activate no longer filtered from pointer hover surfaces; the drop zone and keyboard menu of ADR-057 stand)

## Context

ADR-057 §4 filtered `activate` out of the chip set on pointer hover surfaces (`CardControl.svelte`, `HandZoomOverlay.svelte`), keeping it only in the keyboard-pinned menu, on the theory that pointer activation belongs to the drag-to-zone gesture. In play this made activation undiscoverable: owner feedback round 2026-09-02 reports "Monster that have an activated ability in my hand does not have the action button appear. For spell, action button for setting appear but not activating the card. Drag and dropping works." A hand card whose only legal action is `activate` (hand traps, ignition hand effects) showed zero chips on hover — a legal action with no visible affordance.

The engine data was never the problem: `SELECT_IDLE_COMMAND` projection emits `activate` actions for every card in `message.activates`; only the UI-side filter (`handChipChoices` in `src/battle/app/prompts/hand-activation-choices.ts`) hid them.

## Decision

1. Pointer hover surfaces show the full legal choice set, `activate` included. The filter (and its now-identity wrapper `handChipChoices`) is deleted; call sites pass choices through.
2. The ADR-057 activation drop zone and drag path remain; hover chip and drag are now two coequal pointer routes to the same choice.
3. The keyboard-pinned menu is unchanged (it always had the full set).

## Consequences

- ADR-057's asymmetry rationale inverts: the accessibility concern (§4's keyboard carve-out) is now moot because every surface shows everything. Its documented trap — "a newcomer would delete the chip everywhere" — is retired.
- Hover chip rows on multi-action cards get one entry longer; a spell now shows Set and Activate side by side, which is exactly what the owner asked for.
- An accidental chip click activates without the drag gesture's travel distance. The confirm-dialog rule of ADR-057 §3 applies only to drops, so chip activation commits in one click — same as every other chip action today.

## Alternatives rejected

- **Keep the filter for monsters, lift it for spells.** The feedback names both; a type-split filter is a rules-shaped UI heuristic of the kind this codebase bans (presentation must not model legality).
- **Show Activate only when it is the card's sole action.** Fixes the zero-chip case but keeps the spell inconsistency the owner explicitly reported.
- **Route hover activation through a confirm dialog.** Adds friction no other chip action has; cancellability was a drag-gesture concern (mid-air release), not a click concern.
