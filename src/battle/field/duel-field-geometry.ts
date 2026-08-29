import type { PhysicalZoneId } from "./duel-field-layout.ts";

export const ZONE_GAP = 5;
export const CARD_ASPECT = 72 / 104;
export const CARD_INSET = 0.86;

const MARGIN = 0.15;
const BAND = 0.12;
const MIDDLE_BAND = 0.78;
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
  readonly bandHeight: number;
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
  bandHeight: 0,
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

  const middleRows = extraMonsterZones ? MIDDLE_BAND : BAND;
  const hP = 2 * MARGIN + 6 + middleRows;
  const k = CARD_INSET * CARD_ASPECT;
  /* The outer piles contribute three slot widths across the board:
     width = (2*MARGIN + 5 + 3*k)*pitch
       + 3*(SLOT_PAD - k*ZONE_GAP) + 2*ZONE_GAP. */
  const widthCoeff = 2 * MARGIN + 5 + 3 * k;
  const widthConst = 3 * (SLOT_PAD - k * ZONE_GAP) + 2 * ZONE_GAP;
  const pitch = Math.min(
    availableHeight / hP,
    (availableWidth - widthConst) / widthCoeff,
  );
  if (!Number.isFinite(pitch) || pitch <= ZONE_GAP) return ZERO_GEOMETRY;

  const box = pitch - ZONE_GAP;
  const margin = MARGIN * pitch;
  const bandHeight = middleRows * pitch;
  const cardHeight = box * CARD_INSET;
  const cardWidth = cardHeight * CARD_ASPECT;
  const slotWidth = cardWidth + SLOT_PAD;

  const rowY: number[] = [];
  let y = margin + box / 2;
  let bandY = 0;
  for (let index = 0; index < 6; index += 1) {
    if (index === 3) {
      bandY = y - box / 2 + bandHeight / 2;
      y += bandHeight + ZONE_GAP;
    }
    rowY.push(y);
    y += pitch;
  }

  const columnX = new Array<number>(COLS);
  columnX[0] = margin + slotWidth / 2;
  columnX[1] = margin + slotWidth + ZONE_GAP + box / 2;
  for (let index = 2; index <= 5; index += 1)
    columnX[index] = columnX[index - 1]! + pitch;
  columnX[6] = columnX[5]! + box / 2 + ZONE_GAP + slotWidth / 2;
  columnX[7] = columnX[6]! + slotWidth + ZONE_GAP;

  const frozenColumns = Object.freeze(columnX);
  const emzX = Object.freeze([frozenColumns[2]!, frozenColumns[4]!] as const);

  return Object.freeze({
    pitch,
    box,
    width: frozenColumns[7]! + slotWidth / 2 + margin,
    height: hP * pitch,
    margin,
    cardWidth,
    cardHeight,
    slotWidth,
    rowY: Object.freeze(rowY),
    bandY,
    bandHeight,
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

  const playerRows = {
    1: { hand: 0, spellTrap: 1, monster: 2 },
    0: { monster: 3, spellTrap: 4, hand: 5 },
  } as const;

  for (const player of [0, 1] as const) {
    const rows = playerRows[player];
    for (let sequence = 0; sequence < 5; sequence += 1) {
      addZone(
        zones,
        `p${player}:mainMonster:${sequence as 0 | 1 | 2 | 3 | 4}`,
        geometry.columnX[sequence + 1]!,
        geometry.rowY[rows.monster]!,
        geometry.box,
        geometry.box,
      );
      addZone(
        zones,
        `p${player}:spellTrap:${sequence as 0 | 1 | 2 | 3 | 4}`,
        geometry.columnX[sequence + 1]!,
        geometry.rowY[rows.spellTrap]!,
        geometry.box,
        geometry.box,
      );
    }
    addZone(
      zones,
      `p${player}:field`,
      geometry.columnX[0]!,
      geometry.rowY[rows.monster]!,
      geometry.slotWidth,
      geometry.box,
    );
    addZone(
      zones,
      `p${player}:graveyard`,
      geometry.columnX[6]!,
      geometry.rowY[rows.monster]!,
      geometry.slotWidth,
      geometry.box,
    );
    addZone(
      zones,
      `p${player}:banished`,
      geometry.columnX[7]!,
      geometry.rowY[rows.monster]!,
      geometry.slotWidth,
      geometry.box,
    );
    addZone(
      zones,
      `p${player}:extra`,
      geometry.columnX[0]!,
      geometry.rowY[rows.spellTrap]!,
      geometry.slotWidth,
      geometry.box,
    );
    addZone(
      zones,
      `p${player}:deck`,
      geometry.columnX[6]!,
      geometry.rowY[rows.spellTrap]!,
      geometry.slotWidth,
      geometry.box,
    );
    addZone(
      zones,
      `p${player}:hand`,
      geometry.width / 2,
      geometry.rowY[rows.hand]!,
      geometry.width - 2 * geometry.margin,
      geometry.box,
    );
  }

  if (extraMonsterZones) {
    addZone(
      zones,
      "shared:extraMonster:left",
      geometry.emzX[0],
      geometry.bandY,
      geometry.box,
      geometry.bandHeight,
    );
    addZone(
      zones,
      "shared:extraMonster:right",
      geometry.emzX[1],
      geometry.bandY,
      geometry.box,
      geometry.bandHeight,
    );
  }

  return Object.freeze({ geometry, zones: Object.freeze(zones) });
}

export function perspectiveVirtualHeight(
  boardHeight: number,
  tiltDeg: number,
  cameraPx: number,
): number {
  if (
    !Number.isFinite(boardHeight) ||
    !Number.isFinite(tiltDeg) ||
    !Number.isFinite(cameraPx) ||
    boardHeight <= 0
  )
    return boardHeight;

  const tiltRad = (tiltDeg * Math.PI) / 180;
  const denominator =
    cameraPx * Math.cos(tiltRad) - boardHeight * Math.sin(tiltRad);
  if (denominator <= 0) return boardHeight;
  return (boardHeight * cameraPx) / denominator;
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
