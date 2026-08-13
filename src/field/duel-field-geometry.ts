import type { PhysicalZoneId } from "./duel-field-layout.ts";

export const ZONE_GAP = 5;
export const CARD_ASPECT = 72 / 104;

const MARGIN = 0.15;
const BAND = 0.55;
const SLOT_PAD = 6;
const COLS = 8;

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

const ZERO_GEOMETRY: FieldGeometry = Object.freeze({
  pitch: 0,
  box: 0,
  width: 0,
  height: 0,
  margin: 0,
  cardWidth: 0,
  cardHeight: 0,
  slotWidth: 0,
  rowY: Object.freeze([]),
  bandY: 0,
  columnX: Object.freeze([]),
  emzX: Object.freeze([0, 0] as const),
});

export function computeFieldGeometry(
  extraMonsterZones: boolean,
  availableWidth: number,
  availableHeight: number,
): FieldGeometry {
  if (
    !Number.isFinite(availableWidth) ||
    !Number.isFinite(availableHeight) ||
    availableWidth <= 0 ||
    availableHeight <= 0
  )
    return ZERO_GEOMETRY;

  const rows = extraMonsterZones ? 7 : 6;
  const hP = 2 * MARGIN + rows + (extraMonsterZones ? 0 : BAND);
  const hC = extraMonsterZones ? -ZONE_GAP : 0;
  const wP = 2 * MARGIN + COLS;
  const wC = -ZONE_GAP;
  const pitch = Math.min(
    (availableHeight - hC) / hP,
    (availableWidth - wC) / wP,
  );
  if (!Number.isFinite(pitch) || pitch <= ZONE_GAP) return ZERO_GEOMETRY;

  const box = pitch - ZONE_GAP;
  const margin = MARGIN * pitch;
  const band = BAND * pitch;
  const rowY: number[] = [];
  let y = margin + box / 2;
  let bandY = 0;
  for (let index = 0; index < rows; index += 1) {
    if (!extraMonsterZones && index === 3) {
      bandY = y - box / 2 + band / 2;
      y += band + ZONE_GAP;
    }
    rowY.push(y);
    y += pitch;
  }
  if (extraMonsterZones) bandY = rowY[3]!;

  const columnX = Array.from(
    { length: COLS },
    (_, index) => margin + box / 2 + index * pitch,
  );
  const frozenColumns = Object.freeze(columnX);
  const emzX = Object.freeze([
    frozenColumns[2]! + pitch / 2,
    frozenColumns[3]! + pitch / 2,
  ] as const);

  return Object.freeze({
    pitch,
    box,
    width: wP * pitch + wC,
    height: hP * pitch + hC,
    margin,
    cardWidth: box * CARD_ASPECT,
    cardHeight: box,
    slotWidth: box * CARD_ASPECT + SLOT_PAD,
    rowY: Object.freeze(rowY),
    bandY,
    columnX: frozenColumns,
    emzX,
  });
}

export function createFieldRenderLayout(
  extraMonsterZones: boolean,
  availableWidth: number,
  availableHeight: number,
): FieldRenderLayout {
  const geometry = computeFieldGeometry(
    extraMonsterZones,
    availableWidth,
    availableHeight,
  );
  const zones = new Map<PhysicalZoneId, FieldPlacement>();
  if (geometry.box === 0)
    return Object.freeze({ geometry, zones: Object.freeze(zones) });

  const playerRows = extraMonsterZones
    ? { 1: { hand: 0, spellTrap: 1, monster: 2 }, 0: { monster: 4, spellTrap: 5, hand: 6 } }
    : { 1: { hand: 0, spellTrap: 1, monster: 2 }, 0: { monster: 3, spellTrap: 4, hand: 5 } };

  for (const player of [0, 1] as const) {
    const rows = playerRows[player];
    for (let sequence = 0; sequence < 5; sequence += 1) {
      addZone(zones, `p${player}:mainMonster:${sequence as 0 | 1 | 2 | 3 | 4}`, geometry.columnX[sequence + 1]!, geometry.rowY[rows.monster]!, geometry.box, geometry.box);
      addZone(zones, `p${player}:spellTrap:${sequence as 0 | 1 | 2 | 3 | 4}`, geometry.columnX[sequence + 1]!, geometry.rowY[rows.spellTrap]!, geometry.box, geometry.box);
    }
    addZone(zones, `p${player}:field`, geometry.columnX[0]!, geometry.rowY[rows.monster]!, geometry.box, geometry.box);
    addZone(zones, `p${player}:graveyard`, geometry.columnX[6]!, geometry.rowY[rows.monster]!, geometry.box, geometry.box);
    addZone(zones, `p${player}:banished`, geometry.columnX[7]!, geometry.rowY[rows.monster]!, geometry.box, geometry.box);
    addZone(zones, `p${player}:extra`, geometry.columnX[0]!, geometry.rowY[rows.spellTrap]!, geometry.box, geometry.box);
    addZone(zones, `p${player}:deck`, geometry.columnX[6]!, geometry.rowY[rows.spellTrap]!, geometry.box, geometry.box);
    addZone(zones, `p${player}:hand`, geometry.width / 2, geometry.rowY[rows.hand]!, geometry.width - 2 * geometry.margin, geometry.box);
  }

  if (extraMonsterZones) {
    addZone(zones, "shared:extraMonster:left", geometry.emzX[0], geometry.rowY[3]!, geometry.box, geometry.box);
    addZone(zones, "shared:extraMonster:right", geometry.emzX[1], geometry.rowY[3]!, geometry.box, geometry.box);
  }

  return Object.freeze({ geometry, zones: Object.freeze(zones) });
}

function addZone(
  zones: Map<PhysicalZoneId, FieldPlacement>,
  id: PhysicalZoneId,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  zones.set(id, Object.freeze({ x, y, width, height }));
}
