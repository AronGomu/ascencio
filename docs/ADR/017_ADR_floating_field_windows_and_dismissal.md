# ADR-017: Floating Field Windows And Dismissal

> Status: accepted; planned
> Decided: 2026-08-10
> Owners: field interaction presentation
> Plan: [`../../artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`](../../artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md) — T14, T16

## Context

Round-2 `ZoneListDialog` is centred absolute UI and multi-select confirmation is a bottom action bar. Round 3 requires both to move within the visible duel field, persist independently and coexist with legal field targets. ADR-007 owns pile-address mapping; ADR-009 owns selection; ADR-010 owns phase geometry. This ADR owns window mechanics/dismissal only.

## Decision

1. One `FloatingFieldWindow` renders inside a nonmodal overlay bounded by the visible `.duel-field` viewport, outside any scrolling 52rem board content.
2. Window position is top-left field-local CSS px, measured in the field root's padding box — the same box that is the absolute containing block for the window, so a persisted `{x, y}` and the rendered offset are the same number. Boundary size is the root's `clientWidth/clientHeight`; window size is the window's `offsetWidth/offsetHeight` border box. `null` centres responsively; persisted non-null coordinates are clamped after measurement.
3. Entire border box remains inside boundary on mount, drag, content resize and field resize. Oversized axis pins to zero.
4. Header/handle starts drag; interactive child does not. Pointer capture retains drag outside handle.
5. Persist final clamped position on pointerup and changed reclamp on resize. Zone-list and confirm keys remain independent under ADR-013.
6. Last activated window rises in ephemeral memory; z-order is not persisted.
7. Windows are `aria-modal=false`, have no backdrop, and may coexist with mounted field targets.
8. Browse list closes via header X, footer Cancel, Escape or outside pointerdown. Wheel over list scrolls its horizontal body.
9. Target list has no X. Outside pointerdown/Escape preserve window + draft. Explicit Cancel exists only when engine prompt is cancelable. Visual collapse is allowed; collapsed/open state is not persisted.
10. Confirm never closes/cancels/passes via outside pointerdown or Escape. It closes only after accepted submit, prompt replacement/result, or explicit engine-valid Cancel.
11. Pointerdown inside any window never triggers that window's outside dismissal. Clicking confirm may close browse list because it is outside browse list; confirm remains.
12. Target-list mode owns its counter/Validate/conditional Cancel and suppresses separate confirm window. On-field-only multi-select uses confirm window. ADR-021 owns list contents/selection; this ADR owns shell mechanics.

## Dismissal matrix

| Event | Browse list | Target list | Confirm |
| --- | --- | --- | --- |
| header X | close | absent | n/a |
| footer Cancel | close | close only when prompt cancelable | close only when prompt cancelable |
| outside pointerdown | close | stay; preserve draft | stay; no response |
| Escape | close | stay; preserve draft | stay; no response |
| collapse | absent | 58×58 visual state; preserve draft/anchor | absent |
| prompt replacement/result | close | close | close |
| accepted submit | close | close | close |
| drag past edge | clamp | clamp | clamp |
| wheel over body | horizontal scroll | horizontal scroll | normal content scroll if needed |

## Alternatives rejected

- **Modal backdrop.** Blocks mixed on/off-field prompts.
- **One shared position.** Windows jump when content switches.
- **Viewport-relative coordinates.** Wrong ownership/boundary and fragile under app layout.
- **Outside click cancels confirm.** Silently discards live engine decision.
- **Separate window per zone.** Clutter; one aggregate target list is sufficient.
- **Put windows inside board scroll content.** Panning board could move decision UI offscreen.

## Shipped in T14

- `.duel-field` became `overflow: hidden` with a single `minmax(0, 1fr)` grid row, and the board/stage moved into `.duel-field-scroll-region`, which owns both scroll axes. Windows, the drag ghost and the feedback toast stay outside that child, so a board pan cannot move them.
- Layer order is `--duel-field-layer-window: 110`, `--duel-field-layer-window-active: 120`, below the T13 drag ghost at `150`.
- The confirm window's presence disables the generic field outside-click entirely: `DuelField.dismissOnOutsideClick` returns before dispatching, which supersedes round 2's "outside click passes a chain". The chain's own Pass control lives in the window.
- `FieldActionBar` lost its absolute placement and its measured `clientHeight`; the stage's reserved bottom gutter (`--field-action-bar-height`, `data-field-action-bar`) is gone with it.
- `ondismiss` carries the dismissing event so the owner can tell an outside press on the pile that opened the list from any other press, and keep the pile's click a toggle.

## Consequences

- T9's field scroll region moved to an inner child so the root remains a stable window boundary.
- Persisted positions can become stale; clamp is part of load/resize contract.
- Generic field outside-click cancellation must yield whenever confirm exists.
- T16 reuses zone-list window and one selection session; it does not add modal state.
