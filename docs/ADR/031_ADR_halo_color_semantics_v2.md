# ADR-031: Halo Color Semantics v2

> Status: accepted; planned
> Decided: 2026-08-16
> Owners: field presentation architecture
> Supersedes: the list-hover clause of ADR-015 (field clauses stand)
> Plan: [`../../ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`](../../ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md) — T14

## Context

ADR-015 fixed green = legal, orange = selected on the field, but allowed the list dialog an "orange on any hover" affordance. Product feedback tightens the language: hover must not paint neutral cards at all, and invalid choices need their own color instead of grayscale. Three meanings, three colors, everywhere.

## Decision

1. Green (`--success` border, `--legal` glow): actionable — an effect can trigger here / this card is a legal target. Applies on the field (unchanged) and now on list-entry hover/focus for entries that carry choices.
2. Orange (`--warning` border, `--selected` glow): selected. Persisted class only, never a hover color. Wins over green.
3. Red (`--danger` ring): invalid target. Two surfaces:
   - list entries not currently choosable (over-maximum, hard-locked) — replaces the grayscale/muted treatment;
   - field cards while a card-targeting prompt is active: hovering a non-candidate card shows a red ring, **hover-only**, never persistent (`data-targeting` attribute on the field root drives the CSS).
4. Neutral (no choices): no halo, hover included. Keyboard focus keeps the neutral high-contrast `is-navigation-active` ring — focus visibility is not a legality signal.
5. Field-side drag drop-candidate tinting (green fill family) unchanged.

## Alternatives rejected

- Keep orange hover in lists: hover would mean "pointer is here", colliding with selected; feedback explicitly assigns orange to selection only.
- Passive red on every non-candidate card during targeting (no hover requirement): paints the whole board red on wide prompts; hover-only keeps red an answer to the player's own pointer question ("can I take this one?").
- Click-rejection flash instead of hover affordance: no passive signal at all; rejected in grill round 1.
