# ADR-017: Floating Field Windows And Dismissal

> Status: accepted; planned
> Decided: 2026-08-10
> Owners: field interaction presentation
> Plan: [`../../ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`](../../ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md) — T14, T16

## Context

Round-2 `ZoneListDialog` is centred absolute UI and multi-select confirmation is a bottom action bar. Round 3 requires both to move within the visible duel field, persist independently and coexist with legal field targets. ADR-007 owns pile-address mapping; ADR-009 owns selection; ADR-010 owns phase geometry. This ADR owns window mechanics/dismissal only.

## Decision

1. One `FloatingFieldWindow` renders inside a nonmodal overlay bounded by the visible `.duel-field` viewport, outside any scrolling 52rem board content.
2. Window position is top-left field-local CSS px. `null` centres responsively; persisted non-null coordinates are clamped after measurement.
3. Entire border box remains inside boundary on mount, drag, content resize and field resize. Oversized axis pins to zero.
4. Header/handle starts drag; interactive child does not. Pointer capture retains drag outside handle.
5. Persist final clamped position on pointerup and changed reclamp on resize. Zone-list and confirm keys remain independent under ADR-013.
6. Last activated window rises in ephemeral memory; z-order is not persisted.
7. Windows are `aria-modal=false`, have no backdrop, and may coexist with mounted field targets.
8. Zone list closes via red X, Escape or outside pointerdown. Wheel over list scrolls its horizontal body.
9. Confirm never closes/cancels/passes via outside pointerdown or Escape. It closes only after accepted submit, prompt replacement/result, or explicit engine-valid Cancel.
10. Pointerdown inside either window never triggers that window's outside dismissal. Clicking confirm may close list because it is outside list; confirm remains.
11. Target-list mode may put its counter/Confirm inside zone-list window and suppress separate confirm window. On-field-only multi-select uses confirm window.

## Dismissal matrix

| Event | Zone list | Confirm |
| --- | --- | --- |
| red X | close | n/a |
| outside pointerdown | close | stay; no response |
| Escape | close | stay; no response |
| prompt replacement/result | close | close |
| accepted submit | close | close |
| explicit valid Cancel | close | close |
| drag past edge | clamp | clamp |
| wheel over body | horizontal scroll | normal content scroll if needed |

## Alternatives rejected

- **Modal backdrop.** Blocks mixed on/off-field prompts.
- **One shared position.** Windows jump when content switches.
- **Viewport-relative coordinates.** Wrong ownership/boundary and fragile under app layout.
- **Outside click cancels confirm.** Silently discards live engine decision.
- **Separate window per zone.** Clutter; one aggregate target list is sufficient.
- **Put windows inside board scroll content.** Panning board could move decision UI offscreen.

## Consequences

- T9 may need an inner field scroll region so root remains stable window boundary.
- Persisted positions can become stale; clamp is part of load/resize contract.
- Generic field outside-click cancellation must yield whenever confirm exists.
- T16 reuses zone-list window and one selection session; it does not add modal state.
