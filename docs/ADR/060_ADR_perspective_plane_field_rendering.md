# ADR-060: Perspective-Plane Field Rendering

> Status: accepted; planned
> Decided: 2026-08-29
> Owners: browser presentation architecture
> Relates: ADR-019 (pixel geometry the plane projects), ADR-016 (drag physics that must survive the transform)

## Context

Owner wants the Tag Force look: camera behind the player, own hand largest, opponent hand smallest, field receding. Field today is a flat, uniformly scaled pixel grid (ADR-019) rendered by absolutely positioned Svelte elements driven by `--field-x/y/width/height` px vars.

Prototype round (2026-08-29) compared three models on identical DOM: flat, a 2-D homography baked into the layout math, and one CSS-3D plane. Owner locked the CSS-3D look with exact numbers: tilt 20°, `perspective(600px)`, hand cards counter-tilted fully upright, 5° hand fan with outer-card droop.

At 600px camera distance the projection compresses the plane hard: a plane the size of the board leaves roughly the top third of the board box empty. Measured in the prototype at a 1180×738 board: projected height 488px, 249px dead band on top.

Native hit testing (`click`, `elementFromPoint`) resolves through CSS transforms — already relied on for the portrait quarter-turn stage (`src/battle/app/presentation/stage-frame.ts`). `getBoundingClientRect()` on transformed content returns projected screen-space boxes, which is exactly what the drag ghost, hover-zoom anchor and feedback flights consume.

## Decision

1. The duel board renders inside **one** transformed wrapper (`.duel-field-board__plane`): `perspective(600px) rotateX(20deg)`, `transform-origin: 50% 100%`. Zones, cards, hand bands, stacks keep their flat layout math untouched inside it; the compositor does all projection. Constants live in `src/battle/field/perspective.ts` (`FIELD_TILT_DEG = 20`, `FIELD_CAMERA_PX = 600`).
2. The flat canvas is **taller than the board box**: `Hv = Hb·d / (d·cosθ − Hb·sinθ)` (closed form; `Hb` board height, `d` camera, `θ` tilt). The plane is bottom-anchored and its content bottom-anchored/centred, so the near edge — the player's hand — never moves and the projected far edge lands on the board's top. Non-positive denominator falls back to `Hv = Hb` (flat).
3. The board box itself (section size, scroll region, floating-window clamp boundary) stays at the measured slot size. Overlays that must not distort — drag ghost, hand-zoom overlay, dialogs, floating windows, feedback lines — mount outside the plane; no `position: fixed` element may be a plane descendant (a transformed ancestor would become its containing block).
4. Hand cards, both sides, counter-tilt `rotateX(-20deg)` (derived from `FIELD_TILT_DEG`, never a second literal) so held cards face the camera; each fans up to ±5° from the middle card with proportional droop. Field cards, zones and text lie flat on the plane.
5. Presentation only: the projection never feeds legality, layout addressing, or engine state. An empty transform string renders the identical flat field, and component tests run in that mode's DOM without caring.

## Consequences

- Depth gradient at lock (projected card heights, prototype-measured): own hand 1.00 → own S/T 0.71 → own monsters 0.61 → EMZ 0.43 → opp monsters 0.47 → opp S/T 0.41 → opp hand 0.66 (upright cards face the camera, hence larger than the row they stand on). That non-monotonic bump at the opponent hand is deliberate — it is the Tag Force silhouette.
- Far-row text and art render smaller and slightly softened by the projection. Accepted; the field's readable surfaces (chips, dialogs, preview, rail) live outside the plane.
- Every `clientWidth/Height`-derived layout now describes the *flat canvas*, not the screen. Anyone adding code that mixes a projected rect with a flat-canvas coordinate will produce a subtle offset; the plane wrapper is the single boundary where the two spaces meet.
- The opponent's upright hand overlaps their spell/trap row on screen. Their hand is card backs only, so the overlap hides nothing.

## Alternatives rejected

- **2-D homography in the layout math** (per-element scale/position, everything stays axis-aligned rects). Zero transform risk, but flat sides — no converging trapezoid, noticeably less "table". Owner compared both live and chose the 3-D look.
- **Uniform scale-up to fill the dead top band.** Width is already the binding constraint at the near edge; scaling 1.5× to fill 738px clips the near corners (deck, banish, LP) behind `overflow: hidden`. The virtual-height canvas fills the top without touching the near edge.
- **Iterative measure-and-correct fit** (build, measure projected box, rescale, repeat — the prototype's first implementation). Converges to the same number the closed form gives exactly, but needs a live compositor, so it is untestable in jsdom and left a ~6px residual at the iteration cap.
- **Per-row `scale()` on each element without a shared plane.** Breaks the single-space invariant (every element pair needs its own math), and produces no horizontal convergence.
- **Canvas/WebGL field.** Architecture rule stands: Svelte owns all interactive field UI; canvas is at most future pointer-transparent decoration behind a separate measured ADR.
