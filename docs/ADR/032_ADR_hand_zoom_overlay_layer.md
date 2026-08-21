# ADR-032: Hand Zoom Overlay Layer

> Status: accepted; planned
> Decided: 2026-08-16
> Owners: field presentation architecture
> Commit: `993c944` — T6, T7

## Context

Hand cards live in a scrollport (`overflow-x: auto; overflow-y: hidden`) — required for 20-card hands. Any in-place hover zoom is clipped by that box. Product wants the hovered card to escape everything: field, panels, windows, with its action buttons directly above the enlarged art. Same constraint the drag ghost already solved with a `position: fixed` layer.

Second rule folded in: zoom is knowledge-gated. A face-down card the viewer does not know (`BoardCardView.code === undefined`, ADR-014 attestation) must not zoom or label; a known face-down card zooms and keeps its name strip.

## Decision

1. Zoom gate = projected `code` presence. New `is-identity-known` class on `.duel-field-card`; both zoom variants and the name label key off it.
2. Hand hover zoom renders in `HandZoomOverlay.svelte`: `position: fixed`, new token `--duel-field-layer-hand-zoom: 140` (above floating windows 110/120, below drag ghost 150). Anchored to the hovered card's rect via the stage-frame helpers, grows upward from the card's bottom edge, **1.6× — subtle by design** (grill round 1 Q7): the overlay is hover emphasis/feedback, not an information surface; card details live in the preview panel (incl. the ADR-planned stats row).
3. The overlay is interactive: it hosts the card's `CardActionChips` row just above the art. In-band hover chips are suppressed for hand cards; hover zoom-in-place is removed for hand cards.
4. Pointer-only. Keyboard keeps the pin/focus flow (in-place focus zoom + in-band chips) — the overlay never steals focus, so the e2e keyboard walker and `assertRectInsideViewport` invariants stay intact.
5. Overlay dies on: pointer leaving card+overlay union, drag start, prompt change, board change. One overlay max.

## Alternatives rejected

- `overflow: visible` on the band viewport: CSS cannot mix visible-y with auto-x; the browser degrades visible to auto.
- Reparenting the real card node on hover (portal the DOM): breaks roving focus, drag capture and the feedback controller's `data-card-id` queries.
- Overlay on keyboard focus too: chips already have a focus-safe pin flow; duplicating it in a fixed layer doubles focus surfaces for no gain.
