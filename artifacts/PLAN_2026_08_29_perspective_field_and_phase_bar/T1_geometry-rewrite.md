# T1: Compact flat geometry + perspective virtual-height math

**Plan:** `./artifacts/PLAN_2026_08_29_perspective_field_and_phase_bar.md`
**Depends:** none
**Commit outcome:** `duel-field-geometry.ts` produces the compacted layout (narrow pile zones, on-grid EMZ, tight middle band, card inset sizes) and exports a pure `perspectiveVirtualHeight()`; all geometry consumers compile and their tests pass against the new numbers.

## Context (self-contained)

- Goal: duel field renders on a CSS-3D tilted plane; the flat geometry underneath is compacted first so the projection has the validated shape.
- This slice: pure math only. No Svelte, no CSS, no transform. Everything downstream (T2–T4) consumes these numbers.
- Out of scope here: any component/CSS change; `PhaseStrip.svelte` keeps compiling against `bandY`/`emzX` until T4 removes it.
- Assumptions in force: A2 (LP untouched).

## Requirements

- Middle of the field:
  - With EMZ: middle band height `MIDDLE_BAND = 0.78 * pitch`; EMZ zones centred at `columnX[2]`/`columnX[4]` (monster columns 1 and 3), zone height = band height, width = `box`.
  - Without EMZ: band height `BAND = 0.12 * pitch`.
  - Row indices unified for both profiles: 6 rows, `rowY` length 6, band between rows 2 and 3. `playerRows` split in `createFieldRenderLayout` collapses to one map: p1 `{hand:0, spellTrap:1, monster:2}`, p0 `{monster:3, spellTrap:4, hand:5}`.
- Upright-only zones (`field`, `deck`, `extra`, `graveyard`, `banished`): width `slotWidth = cardWidth + 6`, height `box`. Their columns leave exactly `ZONE_GAP` border-to-border against neighbours: `columnX[0] = margin + slotWidth/2`, `columnX[1] = margin + slotWidth + ZONE_GAP + box/2`, `columnX[2..5]` at pitch steps, `columnX[6] = columnX[5] + box/2 + ZONE_GAP + slotWidth/2`, `columnX[7] = columnX[6] + slotWidth + ZONE_GAP`.
- Width fit closed form (slot width is linear in pitch): `k = CARD_INSET * CARD_ASPECT`; `widthCoeff = 2*MARGIN + 5 + 3*k`; `widthConst = 3*(SLOT_PAD − k*ZONE_GAP) + 2*ZONE_GAP`; `pitch = min(availableHeight / hP, (availableWidth − widthConst) / widthCoeff)` with `hP = 2*MARGIN + 6 + middleRows`.
- Card size: `cardHeight = box * CARD_INSET (0.86)`, `cardWidth = cardHeight * CARD_ASPECT`. Geometry exposes both (it already does; values change).
- New export `perspectiveVirtualHeight(boardHeight, tiltDeg, cameraPx)`: closed form `Hv = Hb·d / (d·cosθ − Hb·sinθ)`. Guard: non-finite inputs, `boardHeight <= 0`, or denominator `<= 0` → return `boardHeight` (flat fallback, never a negative/Infinity canvas).
- Reference numbers from the validated prototype (`artifacts/prototype_field_perspective.html`, its `computeFieldGeometry` is the executable spec for this ticket).

## Inputs

- `src/battle/field/duel-field-geometry.ts` — file to rewrite.
- `src/battle/field/duel-field-layout.ts` — `PhysicalZoneId` union (unchanged).
- `tests/unit/duel-field-geometry.test.ts` — existing expectations to update.
- `tests/unit/field-navigation.test.ts:318`, `tests/component/PhaseStrip.test.ts:29`, `tests/component/DuelField.test.ts` (`createFieldRenderLayout(true, 1280, 720)` sites) — consumers that must stay green (update literals only where an assertion hardcodes old geometry).

## Interface contract (level 5)

- **Produces** (same file, changed semantics):

```ts
export const ZONE_GAP = 5;
export const CARD_ASPECT = 72 / 104;
export const CARD_INSET = 0.86;               // new export

export interface FieldGeometry {
  readonly pitch: number;
  readonly box: number;
  readonly width: number;                      // columnX[7] + slotWidth/2 + margin
  readonly height: number;                     // hP * pitch
  readonly margin: number;
  readonly cardWidth: number;                  // box * CARD_INSET * CARD_ASPECT
  readonly cardHeight: number;                 // box * CARD_INSET
  readonly slotWidth: number;                  // cardWidth + 6
  readonly rowY: readonly number[];            // ALWAYS length 6
  readonly bandY: number;                      // middle band centre, both profiles
  readonly bandHeight: number;                 // new: MIDDLE_BAND*pitch or BAND*pitch
  readonly columnX: readonly number[];         // length 8, non-uniform (see Requirements)
  readonly emzX: readonly [number, number];    // [columnX[2], columnX[4]]
}

export function computeFieldGeometry(
  extraMonsterZones: boolean, availableWidth: number, availableHeight: number,
): FieldGeometry;

export function createFieldRenderLayout(
  extraMonsterZones: boolean, availableWidth: number, availableHeight: number,
): FieldRenderLayout;   // FieldPlacement per zone; upright-only zones get width slotWidth;
                        // EMZ zones get height = bandHeight, y = bandY

export function perspectiveVirtualHeight(
  boardHeight: number, tiltDeg: number, cameraPx: number,
): number;              // new
```

- **Consumes:** nothing new.
- **Errors:** none thrown; degenerate inputs keep returning `ZERO_GEOMETRY` exactly as today (`pitch <= ZONE_GAP` guard stays).
- **Invariants:**
  - `rowY.length === 6` for both profiles; `bandY` between `rowY[2]` and `rowY[3]`.
  - For every adjacent zone pair on a row, border-to-border gap === `ZONE_GAP` (±0.01 float).
  - `zones` map keys unchanged — the full `PhysicalZoneId` set including `shared:extraMonster:left/right` only when `extraMonsterZones`.
  - `perspectiveVirtualHeight(h, 0, d) === h`; monotonically increasing in `tiltDeg` while denominator positive.
  - All returned objects frozen, as today.

## TDD

1. **Red** — rewrite `tests/unit/duel-field-geometry.test.ts` first against the table below; add `perspectiveVirtualHeight` cases.
2. **Green** — rewrite geometry.
3. **Refactor** — keep the closed-form width fit commented with its derivation.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| unified rows | `computeFieldGeometry(false, 958, 768)` | `rowY.length === 6`, `bandHeight ≈ 0.12*pitch` |
| emz band | `computeFieldGeometry(true, 1328, 1080)` | `bandHeight ≈ 0.78*pitch`, `emzX[0] === columnX[2]`, `emzX[1] === columnX[4]` |
| pile zone width | `createFieldRenderLayout(true, 1328, 1080)` | placement of `p0:deck`.width === `slotWidth`; `p0:mainMonster:0`.width === `box` |
| uniform gaps | same layout | gap(`p0:field`→`p0:mainMonster:0`) === gap(`p0:mainMonster:0`→`p0:mainMonster:1`) === `ZONE_GAP` ±0.01 |
| emz placement | same layout | `shared:extraMonster:left` centre === (`columnX[2]`, `bandY`), height === `bandHeight` |
| card inset | any non-zero geometry | `cardHeight === box*0.86`, `cardWidth === cardHeight*CARD_ASPECT` |
| width fit exact | `computeFieldGeometry(true, 1328, 1e9)` (width-bound) | `width ≈ 1328` ±0.5 |
| virtual height identity | `perspectiveVirtualHeight(720, 0, 600)` | `720` |
| virtual height locked | `perspectiveVirtualHeight(738, 20, 600)` | `≈ 1422` (±1): `738*600/(600*cos20° − 738*sin20°)` |
| virtual height guard | `perspectiveVirtualHeight(2000, 20, 600)` (denominator < 0) | `2000` (flat fallback) |
| zero guard | `computeFieldGeometry(true, 0, 100)` | `ZERO_GEOMETRY` (unchanged) |

## Impl steps

- [ ] 1. Rewrite `tests/unit/duel-field-geometry.test.ts` per table — verify: `npx vitest run tests/unit/duel-field-geometry.test.ts` fails on old code.
- [ ] 2. Rewrite `src/battle/field/duel-field-geometry.ts` (constants, closed-form fit, non-uniform `columnX`, unified rows, `bandHeight`, `perspectiveVirtualHeight`).
- [ ] 3. Fix hardcoded-geometry assertions in `tests/unit/field-navigation.test.ts`, `tests/component/PhaseStrip.test.ts`, `tests/component/DuelField.test.ts` — only literals, no behavior edits.
- [ ] 4. `npm run check:headless` green.

## Validation

- [ ] `npx vitest run tests/unit/duel-field-geometry.test.ts tests/unit/field-navigation.test.ts`
- [ ] `npm run check:headless`
- [ ] no silent-failure swallow added — `none` expected (pure math)
- [ ] app functional: `npm run dev`, duel renders (flat still — transform lands in T2), no missing-placement throw from `FieldBoard.placementFor`
- [ ] commit msg draft: `feat(duel): compact field geometry and add perspective virtual-height math`
