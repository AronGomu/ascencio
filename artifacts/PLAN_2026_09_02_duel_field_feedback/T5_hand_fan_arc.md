# T5: Hand fanning forms a real arc

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** T2 (field pitch change alters `cardHeight`, which feeds droop math — tune the arc once, after T2 lands)
**Commit outcome:** Both hands fan in a visible arc: rotated cards whose vertical offset follows the fan curve, unclipped by the hand viewport.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 8 — cards rotate but sit on one y position; no proper arc; fix for both hands.
- This slice: fan/droop math + viewport clip accommodation in the hand band.
- Out of scope here: selected-card overlay escape (T6 — same clip region, runs after), action chips.
- Assumptions in force: current droop is ~2.6px at typical card height (`droopPxFor` factor `0.004` — visually flat), and any real droop gets cut by `overflow-y: hidden` on the viewport.

## Requirements

- Arc: center card highest, outer cards progressively lower AND rotated (own hand; opponent hand mirrored downward-up via existing `transform-origin: center top`).
- Visible: no card corner clipped by `.duel-field-hand-band__viewport` at hands of 1–10 cards.
- Keyboard focus scale (`app.css:2366` `scale(1.35)`) still fits.

## Inputs

- **From T2:** `--phase-bar-h: 2.5rem` token exists; field/hand geometry sized by the new slot box; `cardHeight` values differ from pre-T2 baseline.
- `HandBand.svelte:56-67`: `HAND_FAN_DEG = 5`, `fanDegFor`, `droopPxFor` (factor `0.004`).
- `CardControl.svelte:68-71`: `--card-fan`/`--card-droop` style emit; CSS `app.css:2340-2358` (`transform: rotate(var(--card-fan)) translateY(var(--card-droop)); transform-origin: center bottom`, opponent `center top`).
- Viewport clip: `app.css:2419-2430` `overflow-y: hidden`; comment `app.css:2335`.
- Tests: `tests/component/HandBand.test.ts:182-200` (exact fan/droop values), `tests/unit/global-styles.test.ts:539-569` (viewport rules).

## Interface contract (level 5)

- **Produces:**
  - `HandBand.svelte` new math (exact):
    ```ts
    const HAND_FAN_DEG = 6;
    const HAND_ARC_FACTOR = 0.12; // fraction of cardHeight at outermost card
    function fanDegFor(index: number, count: number): number {
      const offset = index - (count - 1) / 2;
      return HAND_FAN_DEG * (offset / Math.max(1, (count - 1) / 2));
    }
    function droopPxFor(index: number, count: number): number {
      const half = Math.max(1, (count - 1) / 2);
      const t = (index - (count - 1) / 2) / half; // -1..1
      return t * t * HAND_ARC_FACTOR * cardHeight; // parabolic arc
    }
    ```
  - Viewport accommodation: `--hand-card-height` is currently declared on `.duel-field-card.is-hand-item` (`app.css:2342`), a DESCENDANT of the viewport — custom props inherit downward only, so the viewport cannot read it. Fix: `HandBand.svelte` root style string additionally emits `--hand-card-height: ${cardHeight}px` (the component already has `cardHeight` as a prop), then `.duel-field-hand-band__viewport` gains `padding-bottom: calc(var(--hand-card-height) * 0.14)` (own band; opponent mirrored `padding-top`) — headroom ≥ max droop + rotation sweep. Assert both (var emit + padding rule) in `global-styles.test.ts` / `HandBand.test.ts`.
- **Consumes:** `CardControl` `fanDeg`/`droopPx` props unchanged; CSS transform pipeline unchanged.
- **Errors:** none.
- **Invariants:** single card → fan 0deg, droop 0px; symmetric hands symmetric values; sort order (`displayOrder ?? sequence`, ADR-047) untouched.
- **Integration links:** observe in Chromium: for a 5-card hand, `getBoundingClientRect().top` of outermost card > center card (own hand), monotonic along each side; no card bottom outside band rect.

## TDD

1. **Red** — update `HandBand.test.ts` expected fan/droop to new formula values (compute exact numbers in test from formula constants, not magic literals); add monotonic-arc case for 7 cards.
2. **Green** — math + CSS headroom.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| component HandBand | 5 cards, cardHeight 100 | droops `[12, 3, 0, 3, 12]`, fans `[-6, -3, 0, 3, 6]` |
| component HandBand | 1 card | fan 0, droop 0 |
| component HandBand | 7 cards | droop strictly decreasing toward center |
| unit global-styles | stylesheet | headroom rule present, `overflow-y: hidden` retained |
| e2e | live duel | arc visible: outer card top-y > center card top-y; no clip |

## Impl steps

- [ ] 1. Red: recompute expected values in `HandBand.test.ts`.
- [ ] 2. New math constants + parabolic droop.
- [ ] 3. Viewport headroom CSS + `global-styles.test.ts` update.
- [ ] 4. Chromium screenshot evidence, both hands.

## Validation

- [ ] `npm run check:headless`; component gate (NOT in check:headless): `npx vitest run tests/component/HandBand.test.ts tests/component/HandZoomOverlay.test.ts`
- [ ] manual check: 1–10 card hands, hover zoom still aligns, drag still starts
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `feat(duel-field): parabolic hand fan arc for both hands`
