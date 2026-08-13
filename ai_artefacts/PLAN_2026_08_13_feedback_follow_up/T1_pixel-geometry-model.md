# T1: Pixel geometry model

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** none
**Commit outcome:** Pure px geometry maps every stable physical zone while existing viewport-independent board/nav behavior stays green.

## Context (self-contained)

- Goal: Replace fixed `1280×720` render geometry with one-scale px geometry for full-height field; do not couple Worker/domain/nav output to viewport size.
- This slice: Add pure geometry + render-placement API only. Production Svelte keeps old rendering until later slice.
- Out of scope here: DOM/CSS, resize observation, hands, phase controls, rail, card-list, persistence, Worker/WASM.
- Assumptions in force: absolute `ZONE_GAP=5`; `CARD_ASPECT=72/104`; square zone box; `cardHeight===box`; `slotWidth===cardWidth+6`; no-EMZ 1366×768 may yield ≈886×735.
- No user interaction/preflight needed. Node 24+, deps, Chromium already installed in repo.

## Requirements

- Create `src/field/duel-field-geometry.ts`.
- Keep `PhysicalZoneId`, `mapEngineFieldAddress`, `fieldZoneId`, `fieldZoneAccessibleName` signatures unchanged in `src/field/duel-field-layout.ts`.
- Keep `BoardViewModel` + `SpatialNeighbors` viewport-independent. Existing normalized values may remain as semantic nav inputs; rendering must later ignore them.
- Sanitize nonfinite/nonpositive available dimensions to zero-sized frozen geometry; never return `NaN`/negative dimensions.
- `createFieldRenderLayout(false, …)` must omit `shared:extraMonster:left/right`; all other stable IDs remain.

## Inputs

- `ai-artifacts/DESIGN_2026_08_13_full_height_duel_field.md` §§3, 10, 11 — formula + measured matrix.
- `docs/ADR/019_ADR_full_height_duel_shell_and_pixel_geometry.md` — accepted invariants.
- `src/field/duel-field-layout.ts` — stable IDs/mapping + legacy normalized layout.
- `src/field/board-view-model.ts` — current nav geometry consumer.
- `tests/unit/duel-field.test.ts`, `tests/unit/field-navigation.test.ts` — regression suites.
- **From Depends:** none.

## Required API

```ts
export const ZONE_GAP = 5;
export const CARD_ASPECT = 72 / 104;

export interface FieldGeometry {
  readonly pitch: number;
  readonly box: number;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly slotWidth: number;
  readonly rowY: readonly number[];
  readonly bandY: number;
  readonly columnX: readonly number[];
  readonly emzX: readonly [number, number];
}

export interface FieldPlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FieldRenderLayout {
  readonly geometry: FieldGeometry;
  readonly zones: ReadonlyMap<PhysicalZoneId, FieldPlacement>;
}

export function computeFieldGeometry(
  extraMonsterZones: boolean,
  availableWidth: number,
  availableHeight: number,
): FieldGeometry;

export function createFieldRenderLayout(
  extraMonsterZones: boolean,
  availableWidth: number,
  availableHeight: number,
): FieldRenderLayout;
```

Exact formula; copy without redesign:

```ts
const rows = extraMonsterZones ? 7 : 6;
const hP = 2 * MARGIN + rows + (extraMonsterZones ? 0 : BAND);
const hC = extraMonsterZones ? -ZONE_GAP : 0;
const wP = 2 * MARGIN + COLS;
const wC = -ZONE_GAP;
const pitch = Math.min(
  (availableHeight - hC) / hP,
  (availableWidth - wC) / wP,
);
const box = pitch - ZONE_GAP;
const margin = MARGIN * pitch;
const band = BAND * pitch;
const width = wP * pitch + wC;
const height = hP * pitch + hC;
const cardHeight = box;
const cardWidth = box * CARD_ASPECT;
const slotWidth = cardWidth + SLOT_PAD;
```

Build `rowY` exactly: start `y=margin+box/2`; before no-EMZ row index 3 set `bandY=y-box/2+band/2`, then `y+=band+ZONE_GAP`; push `y`; then `y+=pitch`. EMZ `bandY=rowY[3]`. Build `columnX[i]=margin+box/2+i*pitch`, `i=0..7`. Set `emzX=[columnX[2]+pitch/2,columnX[3]+pitch/2]`.

Coordinate contract: every `FieldPlacement.x/y` is **centre px relative to board padding-box top-left**. `width/height` are border-box px. Svelte applies `left:x;top:y;transform:translate(-50%,-50%)`. No rounding in pure model; browser may round painted rects only. All return objects/arrays/map values frozen.

Invalid budget policy: if either input is nonfinite or ≤0, return geometry with every scalar `0`, `rowY=[]`, `columnX=[]`, `emzX=[0,0]`; `createFieldRenderLayout` returns empty frozen map. If formula yields `pitch<=ZONE_GAP`, use same zero result.

`createFieldRenderLayout` row mapping:

- EMZ: p1 hand=0, p1 S/T=1, p1 monster=2, shared EMZ=3, p0 monster=4, p0 S/T=5, p0 hand=6.
- no-EMZ: p1 hand=0, p1 S/T=1, p1 monster=2, phase band, p0 monster=3, p0 S/T=4, p0 hand=5.
- Columns: Field/Extra=0, sequences 0..4=1..5, GY/Deck=6, Banished=7.
- Zone placement size: all non-hand footprints `box×box`.
- Hands: x=`geometry.width/2`, width=`geometry.width-2*geometry.margin`, height=`geometry.box`.

## TDD

1. **Red** — create `tests/unit/duel-field-geometry.test.ts`; add listed failing formula/placement/invalid-input tests before source module.
2. **Green** — implement minimum pure functions; freeze return objects, arrays, map values.
3. **Refactor** — comment legacy normalized table as nav-only; do not rename public APIs or rewrite mapper.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `computes EMZ geometry from one scale factor at supported budgets` | 1328×1080, 1872×1440, 886×768 | boards ≈1229×1080, 1638×1440, 874×768; ≤1px tolerance |
| `computes accepted no-EMZ small geometry` | false, 886×768 | board ≈886×735; height ratio ≈0.957 |
| `keeps absolute five-pixel gaps` | both profiles | `pitch-box===5`; adjacent centres differ by pitch |
| `makes square footprints and six-pixel slot pad` | both profiles | `cardHeight===box`; `slotWidth-cardWidth===6` |
| `maps every stable PhysicalZoneId` | both profiles | correct row/column; shared IDs only EMZ |
| `keeps navigation stable across viewport sizes` | same board snapshot + 2 render layouts | identical `BoardViewModel.nav` |
| `returns finite empty geometry for invalid budgets` | NaN, Infinity, ≤0 | no negative/NaN; empty placements safe |

## Impl steps

- [ ] 1. Add `tests/unit/duel-field-geometry.test.ts` with exact tests above; run focused cmd; confirm module/test fails for intended missing API.
- [ ] 2. Add constants/interfaces/formula to `src/field/duel-field-geometry.ts` using design `MARGIN=.15`, `BAND=.55`, `SLOT_PAD=6`, `COLS=8`.
- [ ] 3. Add `createFieldRenderLayout`; construct frozen `ReadonlyMap<PhysicalZoneId, FieldPlacement>` with row/column mapping above.
- [ ] 4. Add finite-input guard; zero/invalid budgets return finite zero geometry + empty placements.
- [ ] 5. Update comments/tests in `src/field/duel-field-layout.ts` + `tests/unit/duel-field.test.ts` only where they incorrectly call normalized coordinates production render authority.
- [ ] 6. Add navigation regression in `tests/unit/field-navigation.test.ts`; no `BoardViewModel` public type change.
- [ ] 7. Run focused + type/lint gates; inspect `git diff --check`.

## Outputs

- Created: `src/field/duel-field-geometry.ts`, `tests/unit/duel-field-geometry.test.ts`.
- Touched: `src/field/duel-field-layout.ts`, `tests/unit/duel-field.test.ts`, `tests/unit/field-navigation.test.ts` only if assertions/comments need nav/render distinction.
- Public API: exact signatures above.
- No migration/config.

## Validation

- [ ] `npx vitest run tests/unit/duel-field-geometry.test.ts tests/unit/duel-field.test.ts tests/unit/field-navigation.test.ts` → exit 0.
- [ ] `npm run typecheck` → 0 errors/warnings.
- [ ] `npm run lint` → exit 0.
- [ ] `git diff --check` → no whitespace errors.
- [ ] app functional — `npm run build:app` exits 0; current old renderer unchanged.
- [ ] commit msg draft: `feat(field): add viewport-independent pixel geometry`
