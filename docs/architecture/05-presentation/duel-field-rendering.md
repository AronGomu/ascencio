# Duel-Field Rendering Documentation

> Status: implemented
> Canonical decision: [ADR-001: Semantic DOM Duel-Field Rendering](../../ADR/001_ADR_semantic_dom_duel_field_rendering.md)

This page routes readers to authoritative duel-field rendering documents. It does not duplicate ADR rationale, decision, or consequences.

## Authoritative documents

- [ADR-001](../../ADR/001_ADR_semantic_dom_duel_field_rendering.md) is canonical renderer decision.
- [DOM duel-field architecture](duel-field-architecture.md) defines detailed target boundaries, models, ownership, and UI composition.
- [Validation catalog](duel-field-validation-references.md) defines rule, interaction, accessibility, responsive, and visual references.
- [Implementation plan](../../DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md) defines DF-00 through DF-17 delivery and removal gates.
- [Archived Svelte–Phaser boundary](../../archive/svelte-phaser-boundary.md) preserves historical MVP architecture only.

## Implementation status

Semantic DOM rendering is the production runtime. Phaser scene, bridge, dependency, lazy chunk, license copy, and canvas metadata tests are removed after DF-16 parity and DF-17 removal gates.
