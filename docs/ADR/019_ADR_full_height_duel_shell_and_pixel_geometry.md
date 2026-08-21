# ADR-019: Full-Height Duel Shell And Pixel Geometry

> Status: accepted; planned
> Decided: 2026-08-13
> Owners: browser presentation architecture
> Commit: `41ed12b` — T1–T8
> Supersedes: ADR-003 shell/chrome/geometry decisions

## Context

Current field renders inside fixed logical `1280×720`, width-first shell, top header + `.duel-row`. Dead side bands consume width without increasing card size. Rectangular zones cannot contain one card rotated to Defense Position while preserving uniform gaps.

Validated prototype proves one height-derived px grid, square footprints, no header, fixed preview, flexible right rail.

## Decision

1. Duel view is one `100svh` row: fixed preview, explicit-px board, flexible right rail.
2. Preview width = 22rem; rail floor = 15rem. At viewport ≤1500px: preview = 18rem; rail floor = 12rem.
3. Delete `DuelHeaderBar`; rail owns options, turn/phase, avatars, LP, additive non-authoritative status.
4. Compute board width + height from one scale factor using available middle-column width + viewport height. Set both dimensions explicitly. Do not combine definite height, `aspect-ratio`, independent max width.
5. Zone pitch uses square box + absolute 5px gap. `cardHeight===box`; `cardWidth===box*(72/104)`; slot width = card width + 6px.
6. Outer dashed square is true zone footprint. Upright slot + card are concentric. Face-up Defense + face-down Set rotate card art 90°; outer placement/hover scale remain independent.
7. Worker-projected `layout.extraMonsterZones` selects 7-row EMZ or 6-row + phase-band profile. UI never recomputes rules profile. ADR-018 retains authority.
8. At 1366×768 no-EMZ, board ≈886×735 (95.7% viewport height) is accepted. Do not compress preview below 18rem or rail below 12rem solely to force 100%.
   - Amended 2026-08-21: ADR-042 §2 narrowed the shared `--preview-w` to 15.5rem (13.5rem below the 1500px breakpoint) to size the panel to the card — not to force 100%, so the rule above stands and only its recorded figure moved. That viewport now budgets 958px of middle column, and the board measures ≈925.57×768: height-constrained like every other viewport, at 100% of viewport height.
9. Hands span board inner width, one box high. All cards mount inside real horizontal scroller. Native chrome hidden; decorative custom overlay thumb mirrors + pointer-controls scroll. Count badge stays fixed over wrapper.
10. Phase controls derive anchors/type scale from same geometry. End turn is independent primary control at inner right edge. Every action remains ≥44×44px.
11. Preview effect text uses bounded `minmax(0,1fr)` real vertical scroller, permanent 10px text gutter, decorative custom overlay thumb. Keyboard/wheel semantics remain native.
12. Stable physical IDs, mapping, a11y names, focus graph, Worker authority, hidden-info rules remain unchanged. Viewport px never enters `BoardViewModel` authority.
13. Recovery messages, LoadingOverlay, diagnostics access from ADR-003 survive. Width-first field, permanent header, old pills, blanket session-only display setting rule do not.

## Consequences

- Render placement becomes separate pure `FieldRenderLayout`; normalized board/nav data may remain viewport-independent.
- `ResizeObserver` owns layout recompute on field/profile size changes.
- Hover scale + Defense rotation need separate transform owners.
- Floating windows remain children of visible `.duel-field` boundary; board resizing cannot pan windows away.
- Chromium measures 3 viewports × 2 profiles. Vitest proves formulas/invariants.
- Custom overlay bars never replace real scrollers; no extra Tab stop.

## Rejected

- `aspect-ratio` + `height:100%` + `max-width:100%` → horizontal squash.
- Percent coordinates → 5px gap scales incorrectly.
- Crop dead bands only → width gain, no height/card gain.
- Taller slot → rotated neighbors stop preserving 5px gap.
- Native hand scrollbar → consumes hand height.
- Force 100% at smallest no-EMZ viewport → damages preview/rail readability.
