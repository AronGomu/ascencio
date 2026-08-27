# ADR-015: Halo Semantics — Legal Versus Selected

> Status: accepted; planned
> Decided: 2026-08-10
> Owners: field presentation architecture
> Commit: `5eac0b5` — T12
> Amended by [ADR-058](058_ADR_duel_field_colour_semantics.md): `cardSelection` prompts now render candidates dashed green with no fill, dashed orange when selected, replacing the solid-fill selected/drop-candidate treatment for that prompt family; `cardAction` legality is unchanged.

## Context

Round-2 CSS uses orange for actionable, lime for selected, orange fill for drag candidates and orange again for transient feedback. One colour therefore means multiple incompatible states, while selection uses the colour now requested for legality.

ADR-007 defines stack targets and ADR-009 defines selection/placement policy. This ADR changes visual semantics only; CSS never becomes legality authority.

## Decision

| State | Meaning | Treatment |
| --- | --- | --- |
| legal/actionable | engine-offered choice | green outline/halo |
| selected | included in draft, awaiting Confirm | orange outline/halo |
| drop candidate | presentation guess for possible placement | green outline + translucent green fill |
| keyboard focus | current focus only | neutral high-contrast outer outline |
| feedback target/line | transient presentation event | teal |
| list hover | pointer location only | orange hover |
| disabled | response unavailable/in flight | muted, no legal halo |

Precedence:

1. disabled removes actionable treatment;
2. selected replaces plain legal green with orange;
3. drop candidate replaces plain legal treatment with green fill;
4. focus remains a separate neutral outer outline;
5. feedback remains a separate transient teal layer;
6. hover never changes legality or selected state.

Cards and zone-list entries zoom 1.35× over 120 ms ease-out. Scale applies to root so halo follows. Hand origin points inward (player bottom/opponent top); field/list origin is centre. Reduced-motion removes scale/transition, not static semantics.

Hovered/focused/pinned card parent rises above ordinary cards so its action chips are hit-testable above siblings. Layers remain presentation-only.

## Alternatives rejected

- **Keep orange legal / green selected.** Directly contradicts requested semantics.
- **One colour with fill variants.** Weak distinction between can-act and already-chosen.
- **Reuse semantic colour for focus.** Focus would falsely imply legality/selection.
- **Compute colours in JS.** Existing semantic classes are correct ownership seam.
- **Scale art only.** Border/halo would detach from visual card.

## Consequences

- Same classes apply to mounted cards, zones, stacks, browse entries and ADR-017/target-list rows.
- Tests assert semantic class + CSS contract; screenshots/RGB alone are insufficient.
- T13 reuses green-filled drop state; T16 reuses green/orange list states.
- Attack red and LP danger remain separate.
