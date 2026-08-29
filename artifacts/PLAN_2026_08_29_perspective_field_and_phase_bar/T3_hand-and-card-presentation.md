# T3: Hand upright + fan, card inset + depth shadows

**Plan:** `./artifacts/PLAN_2026_08_29_perspective_field_and_phase_bar.md`
**Depends:** T2
**Commit outcome:** hand cards stand upright toward the camera with a 5° fan and droop; field cards sit inset inside their zones and carry a soft shadow; opponent hand included.

## Context (self-contained)

- Goal: perspective field; this slice is the card-level presentation that sells the "held cards" look.
- This slice: CSS transforms + per-card fan offsets. Purely presentational — legality, choices, drag behavior untouched (presentation never determines legality, AGENTS `## Core architecture rules`).
- Out of scope here: settings toggles (T5 makes shadows optional; here they simply exist), phase bar.
- Assumptions in force: A3 (opponent hand stands upright too).

## Requirements

- Hand cards (both bands): counter-tilt `rotateX(-20deg)` so they face the camera (must equal `FIELD_TILT_DEG` negated — derive from the constant, not a second literal).
- Fan: card at offset `o = index − (n−1)/2` in a band of `n` gets `rotate(fan · o / max(1,(n−1)/2))` with `fan = 5°`, plus vertical droop `|o| · fan · cardHeight · 0.004` px downward. Sorted display order (ADR-047 `displayOrder`) drives `index`, matching what the eye sees.
- Field cards: rendered at `CARD_INSET` (0.86) of the zone box so no card touches a zone border. Today `CardControl.fieldPositionStyle` already narrows width to `placement.width * CARD_ASPECT` (`CardControl.svelte:102`) but keeps full zone height — the inset's observable change is **height** (`box` → `box*0.86`), width follows via aspect. Consume T1's `geometry.cardWidth/cardHeight` instead of deriving from the raw zone placement.
- Shadows: `.duel-field-card` gets `box-shadow: 0 2px 8px color-mix(in srgb, var(--shadow) 55%, transparent)` (single static recipe — the projection itself scales it with depth, no per-row math).
- Hand DOM reality (reviewer finding 2): repo hand cards are **flex items**, not absolutely positioned — `.duel-field-card.is-hand-item` sets `position: relative; transform: none` (`app.css:2194-2209`), `transform-origin` already `center bottom`/`center top` per side (`:2208`, `:2212-2213`), and `:focus-within` applies `transform: scale(1.35)` (`:2219-2221`). Therefore: **no `translate(-50%,-50%)`** in the hand recipe. Composition: `rotateX(var(--hand-upright)) rotate(var(--card-fan)) translateY(var(--card-droop))`, and the focus rule must compose the scale with the same vars (`scale(1.35) rotateX(...) rotate(...)`) or the zoom clobbers the fan on focus.
- `prefers-reduced-motion` is irrelevant (no animation added); do not add a media block.

## Inputs

- **From T2:** `FIELD_TILT_DEG` from `src/battle/field/perspective.ts`; plane wrapper `[data-cy="duel-field-board-plane"]`; `FieldBoard` renders `HandBand`/`CardControl` inside it.
- `src/battle/app/components/duel-field/HandBand.svelte` — band markup, `sortedCards` (`:59`).
- `src/battle/app/components/duel-field/CardControl.svelte` — card root element + `layout` prop (`"hand"` vs field).
- `src/styles/app.css` — `.duel-field-card` block (`:1326` region).
- `tests/unit/data-cy-coverage.test.ts` — any new element needs `data-cy`.

## Interface contract (level 5)

- **Produces:**

```svelte
<!-- HandBand.svelte: per-card CSS custom props, passed via CardControl style -->
<!-- fanDeg computed as: 5 * (offset / Math.max(1, (sortedCards.length - 1) / 2)) -->
<CardControl ... fanDeg={fanDeg} droopPx={droopPx} />
```

```svelte
<!-- CardControl.svelte -->
export let fanDeg = 0;   // hand layout only; field callers never set it
export let droopPx = 0;
<!-- root style gains: --card-fan: {fanDeg}deg; --card-droop: {droopPx}px; -->
```

```css
/* app.css */
.duel-field-card { box-shadow: 0 2px 8px color-mix(in srgb, var(--shadow) 55%, transparent); }
.duel-field-card.is-hand-item {
  transform: rotateX(var(--hand-upright, 0deg)) rotate(var(--card-fan, 0deg))
    translateY(var(--card-droop, 0px));
}
.duel-field-card.is-identity-known.is-hand-item:not(.is-pinned):focus-within {
  transform: scale(1.35) rotateX(var(--hand-upright, 0deg))
    rotate(var(--card-fan, 0deg)) translateY(var(--card-droop, 0px));
}
.duel-field-board__plane { --hand-upright: -20deg; }  /* set from FIELD_TILT_DEG inline by FieldBoard */
```

- **Consumes:** T1 `geometry.cardWidth/cardHeight` (already inset); T2 plane wrapper. Binding: field-layout `CardControl` sizes from `geometry.cardWidth/cardHeight` centred in the zone placement — `FieldBoard.placementFor` result is the zone box, card box derived `{x: zone.x, y: zone.y, width: geometry.cardWidth, height: geometry.cardHeight}` (defense rotation still swaps visually via the existing rotate, box unchanged).
- **Errors:** none.
- **Invariants:**
  - Fan/droop/upright never applied to field cards, stacks, or zones.
  - Drag ghost, hover-zoom anchor, and `elementFromPoint` keep working: they read projected rects, and the counter-tilt only changes the projection, not the DOM structure.
  - `--hand-upright` written once by `FieldBoard` from `FIELD_TILT_DEG`; flat mode (`planeTransform === ""`) sets it to `0deg`.
- **Integration links:** trigger `HandBand` render → observe in Chromium: `getComputedStyle(handCard).transform` is a `matrix3d` (rotateX present) while a field card's is a 2-D `matrix`.

## TDD

1. **Red** — HandBand component test: 5 cards → middle card `--card-fan: 0deg`, outermost `±5deg`, droop positive on outer cards; CardControl field layout ignores fan.
2. **Green** — props + CSS.
3. **Refactor** — none expected.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| fan spread | HandBand, 5 cards | fans `[-5, -2.5, 0, 2.5, 5]deg` in display order |
| fan single | HandBand, 1 card | fan `0deg`, droop `0px` |
| droop | 5 cards | droop of outer cards > inner, middle `0px` |
| field card inert | CardControl `layout="field"` | style has no `--card-fan`/`--card-droop` |
| card inset | FieldBoard render, monster zone card | card element **height** === `geometry.cardHeight` (`box*0.86`), not `box` — red on today's full-height cards |
| upright var | FieldBoard with transform on | plane style contains `--hand-upright: -20deg`; flat mode `0deg` |
| e2e visual | Chromium, started duel | hand card computed transform is matrix3d; screenshot artifact for the checklist |

## Impl steps

- [ ] 1. Red component tests (HandBand fan/droop, CardControl passthrough).
- [ ] 2. HandBand: compute fan/droop from `sortedCards` index; pass to CardControl.
- [ ] 3. CardControl: `fanDeg`/`droopPx` props → CSS vars on root.
- [ ] 4. FieldBoard: card box from `geometry.cardWidth/cardHeight`; `--hand-upright` on the plane.
- [ ] 5. app.css: shadow + hand transform block.
- [ ] 6. Green: `npx vitest run tests/component/HandBand.test.ts tests/component/DuelField.test.ts`.

## Validation

- [ ] `npm run check:headless`
- [ ] manual: hands fan and stand up, both sides; defense-position card still reads rotated; no card touches a zone border
- [ ] no silent-failure swallow added — `none` expected
- [ ] app functional — drag from fanned hand still starts/ends correctly (manual + existing e2e)
- [ ] commit msg draft: `feat(duel): stand hands upright with a fan and inset field cards with shadows`
