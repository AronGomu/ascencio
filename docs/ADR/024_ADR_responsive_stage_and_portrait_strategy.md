# ADR-024: Responsive Stage and Portrait Strategy

> Status: accepted
> Decided: 2026-08-14
> Owners: application-shell, duel-field, deck-editor architecture
> Plan: [`../../artifacts/PLAN_2026_08_14_three_ui_restructure.md`](../../artifacts/PLAN_2026_08_14_three_ui_restructure.md) — T4, T14, T15

## Context

Three UIs must feel like one game across desktop windows, tablets and phones. Browser chrome steals height, so a duel sized to raw viewport height reflows constantly. The duel field is an 8-column pixel geometry (`computeFieldGeometry`) with locked acceptance evidence: ADR-015 halo semantics, ADR-018 conditional Extra Monster Zones, the DF-16 Chromium parity gate and a six-case acceptance matrix. The deck editor is a three-panel desktop layout that blocks itself below 1024px. The visual novel is already responsive down to 30rem.

Two product requirements collided: a fixed 16:9 stage with black bars, and mobile vertical layouts below Full HD. Both claim every window under 1920px.

## Decision

1. Shell owns one layout law, computed by pure module `src/shell/stage-layout.ts`; domains read the result, never recompute it.
2. Breakpoint is **1024 CSS px width**:
   - `width >= 1024` → `stage`: largest centred 16:9 box, leftover filled with `--bg` bars.
   - `width < 1024 && height >= width` → `mobile-portrait`.
   - `width < 1024 && height < width` → `mobile-landscape`: scaled 16:9 stage (already the right shape).
3. Duel portrait is solved by **rotating the stage 90°**, not by a second field geometry. `StageBox.rotated` is true only in `mobile-portrait`; the box is computed against swapped viewport axes. Field geometry, EMZ profile and duel acceptance evidence are untouched.
4. Deck editor portrait is a **single-panel tabbed layout** (Catalog / Deck / Details) with tap-to-add and tap-to-move built on the existing keyboard pick-and-drop mutations. The "Desktop viewport required" dead end is deleted.
5. Story keeps its existing responsive layouts.
6. `body` never scrolls; the stage clips.
7. A dismissible rotation notice explains the duel orientation once; it never blocks input, and transitions respect `prefers-reduced-motion`.

## Alternatives rejected

- **Native vertical duel geometry.** Best mobile fidelity, but a second geometry profile invalidates the six-case matrix, DF-16 evidence, phase anchoring and navigation, for a surface that is not the product's primary target.
- **Scale the landscape board into portrait width.** Cards fall under the 44px pointer floor.
- **Mobile layout below 1920px.** Literal reading of the requirement; sends most laptops to a phone layout.
- **Orientation-only rule.** Cleaner conceptually, but a 900px landscape desktop window then keeps a desktop layout it cannot fit.
- **No letterboxing.** Browser chrome keeps squeezing the field; ratio drifts per window.

## Amendment 2026-08-20: the duel spends the pillarbox

Decision point 2 held both axes of the stage box for every route. It still does, except for the duel's width.

Above the breakpoint a viewport wider than 16:9 — which is what a 1920x1080 screen becomes the moment browser chrome takes a slice of the height — leaves a `--bg` bar on each side. The duel cannot use extra width for a bigger board: `computeFieldGeometry` is driven by the stage height in every desktop case, so a wider field column only pads the board with dead space. The bars were therefore costing the right rail real estate for nothing.

So on `#/duel` and `#/duel/session/*`, above the breakpoint only:

- `--stage-w` becomes `100vw`; `--stage-h` and the whole height law are untouched, so a viewport that is *taller* than 16:9 keeps its top and bottom bars.
- The field column stays sized against the letterboxed width (`--stage-h * 16 / 9`, which is the same number in both the upright and rotated boxes), so the board is pixel-identical and the acceptance matrix is unaffected.
- The board keeps `--duel-field-inset` of the reclaimed width as margin on each side, and the rail's `1fr` absorbs the rest. The inset is clamped to the reclaimed bar, so an exactly-16:9 viewport renders exactly as it did before.
- `.duel-right-rail` caps its avatars against `--stage-h`, because a square sized by a column that now grows would otherwise push the rail past the stage.

Every other route keeps both halves of the original law. `computeStageBox` still reports the 16:9 box: its only consumer is the deck editor, which never renders on the duel route. The stylesheet decides which routes bleed, from the `data-stage-route` the shell reports.

## Consequences

- One `data-stage-mode` attribute and one context value drive every domain's responsive behavior.
- Duel keeps its accepted geometry everywhere; portrait players tilt the device.
- Pointer coordinates stay correct through CSS rotation; drag code must read element rects rather than raw viewport deltas.
- Deck editor gains a touch model without a new interaction contract, because taps reuse keyboard mutations.
- Desktop visuals and evidence are unchanged; any diff in the acceptance matrix is a defect, not an accepted change.
