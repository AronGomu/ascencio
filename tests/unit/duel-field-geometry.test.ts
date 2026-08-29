import { describe, expect, it } from "vitest";
import {
  CARD_ASPECT,
  CARD_INSET,
  computeFieldGeometry,
  createFieldRenderLayout,
  perspectiveVirtualHeight,
  ZONE_GAP,
} from "../../src/battle/field/duel-field-geometry.ts";
import { STANDARD_DUEL_FIELD_LAYOUT } from "../../src/battle/field/duel-field-layout.ts";

function horizontalGap(
  left: { readonly x: number; readonly width: number },
  right: { readonly x: number; readonly width: number },
): number {
  return right.x - right.width / 2 - (left.x + left.width / 2);
}

describe("duel field pixel geometry", () => {
  it("uses six rows and a compact middle band without Extra Monster Zones", () => {
    const geometry = computeFieldGeometry(false, 958, 768);

    expect(geometry.rowY).toHaveLength(6);
    expect(geometry.bandHeight).toBeCloseTo(0.12 * geometry.pitch);
    expect(geometry.bandY).toBeGreaterThan(geometry.rowY[2]!);
    expect(geometry.bandY).toBeLessThan(geometry.rowY[3]!);
  });

  it("centres Extra Monster Zones on monster columns in the middle band", () => {
    const geometry = computeFieldGeometry(true, 1328, 1080);

    expect(geometry.rowY).toHaveLength(6);
    expect(geometry.bandHeight).toBeCloseTo(0.78 * geometry.pitch);
    expect(geometry.emzX[0]).toBe(geometry.columnX[2]);
    expect(geometry.emzX[1]).toBe(geometry.columnX[4]);
    expect(geometry.bandY).toBeGreaterThan(geometry.rowY[2]!);
    expect(geometry.bandY).toBeLessThan(geometry.rowY[3]!);
  });

  it("uses narrow upright pile zones and square central zones", () => {
    const layout = createFieldRenderLayout(true, 1328, 1080);

    for (const player of [0, 1] as const) {
      for (const kind of [
        "field",
        "deck",
        "extra",
        "graveyard",
        "banished",
      ] as const) {
        expect(layout.zones.get(`p${player}:${kind}`)?.width).toBe(
          layout.geometry.slotWidth,
        );
      }
    }
    expect(layout.zones.get("p0:mainMonster:0")?.width).toBe(
      layout.geometry.box,
    );
  });

  it("keeps exact horizontal gaps across non-uniform columns", () => {
    const layout = createFieldRenderLayout(true, 1328, 1080);
    const field = layout.zones.get("p0:field")!;
    const monster0 = layout.zones.get("p0:mainMonster:0")!;
    const monster1 = layout.zones.get("p0:mainMonster:1")!;
    const monster4 = layout.zones.get("p0:mainMonster:4")!;
    const graveyard = layout.zones.get("p0:graveyard")!;
    const banished = layout.zones.get("p0:banished")!;

    for (const gap of [
      horizontalGap(field, monster0),
      horizontalGap(monster0, monster1),
      horizontalGap(monster4, graveyard),
      horizontalGap(graveyard, banished),
    ]) {
      expect(gap).toBeCloseTo(ZONE_GAP, 2);
    }
  });

  it("places Extra Monster Zones in the middle band", () => {
    const layout = createFieldRenderLayout(true, 1328, 1080);

    expect(layout.zones.get("shared:extraMonster:left")).toEqual({
      x: layout.geometry.columnX[2],
      y: layout.geometry.bandY,
      width: layout.geometry.box,
      height: layout.geometry.bandHeight,
    });
    expect(layout.zones.get("shared:extraMonster:right")).toMatchObject({
      x: layout.geometry.columnX[4],
      y: layout.geometry.bandY,
      height: layout.geometry.bandHeight,
    });
  });

  it.each([true, false])(
    "insets cards inside zone footprints for profile %s",
    (extraMonsterZones) => {
      const geometry = computeFieldGeometry(extraMonsterZones, 1328, 1080);

      expect(geometry.cardHeight).toBeCloseTo(geometry.box * CARD_INSET);
      expect(geometry.cardWidth).toBeCloseTo(geometry.cardHeight * CARD_ASPECT);
      expect(geometry.slotWidth - geometry.cardWidth).toBe(6);
    },
  );

  it("fits the compact board width from the closed form", () => {
    const geometry = computeFieldGeometry(true, 1328, 1e9);

    expect(geometry.width).toBeCloseTo(1328, 1);
    expect(geometry.width).toBeLessThanOrEqual(1328);
  });

  it("keeps virtual height unchanged at zero tilt", () => {
    expect(perspectiveVirtualHeight(720, 0, 600)).toBe(720);
  });

  it("matches the locked perspective virtual height", () => {
    expect(perspectiveVirtualHeight(738, 20, 600)).toBeCloseTo(1422, 0);
  });

  it("increases virtual height with tilt while the denominator stays positive", () => {
    const heights = [0, 5, 10, 15].map((tilt) =>
      perspectiveVirtualHeight(720, tilt, 1200),
    );

    expect(heights).toEqual(heights.toSorted((left, right) => left - right));
    expect(new Set(heights).size).toBe(heights.length);
  });

  it.each([
    [2000, 20, 600, 2000],
    [Number.NaN, 20, 600, Number.NaN],
    [720, Number.POSITIVE_INFINITY, 600, 720],
    [720, 20, Number.NEGATIVE_INFINITY, 720],
    [0, 20, 600, 0],
    [-1, 20, 600, -1],
  ])(
    "falls back for invalid virtual-height input %s, %s, %s",
    (boardHeight, tiltDeg, cameraPx, expected) => {
      expect(perspectiveVirtualHeight(boardHeight, tiltDeg, cameraPx)).toEqual(
        expected,
      );
    },
  );

  it.each([true, false])(
    "maps every stable PhysicalZoneId for profile %s",
    (extraMonsterZones) => {
      const layout = createFieldRenderLayout(extraMonsterZones, 1328, 1080);
      const expectedIds = STANDARD_DUEL_FIELD_LAYOUT.map(({ id }) => id).filter(
        (id) => extraMonsterZones || !id.startsWith("shared:extraMonster"),
      );

      expect([...layout.zones.keys()]).toEqual(
        expect.arrayContaining(expectedIds),
      );
      expect(layout.zones.size).toBe(extraMonsterZones ? 34 : 32);
      expect(layout.zones.get("p1:hand")?.y).toBe(layout.geometry.rowY[0]);
      expect(layout.zones.get("p0:mainMonster:4")?.y).toBe(
        layout.geometry.rowY[3],
      );
    },
  );

  it.each([
    [Number.NaN, 768],
    [Number.POSITIVE_INFINITY, 768],
    [886, Number.NEGATIVE_INFINITY],
    [0, 100],
    [-1, 768],
    [886, 0],
    [10, 10],
  ])(
    "returns frozen finite empty geometry for invalid budget %s x %s",
    (width, height) => {
      const layout = createFieldRenderLayout(true, width, height);
      const geometry = layout.geometry;

      expect(Object.isFrozen(layout)).toBe(true);
      expect(Object.isFrozen(layout.zones)).toBe(true);
      expect(layout.zones.size).toBe(0);
      expect(Object.isFrozen(geometry)).toBe(true);
      expect(Object.isFrozen(geometry.rowY)).toBe(true);
      expect(Object.isFrozen(geometry.columnX)).toBe(true);
      expect(Object.isFrozen(geometry.emzX)).toBe(true);
      expect(geometry.rowY).toEqual([]);
      expect(geometry.columnX).toEqual([]);
      expect(geometry.emzX).toEqual([0, 0]);
      for (const value of Object.values(geometry).flatMap((entry) =>
        typeof entry === "number" ? [entry] : entry,
      )) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it("freezes geometry, arrays, map, and placement values", () => {
    const layout = createFieldRenderLayout(true, 1328, 1080);

    expect(Object.isFrozen(layout)).toBe(true);
    expect(Object.isFrozen(layout.geometry)).toBe(true);
    expect(Object.isFrozen(layout.geometry.rowY)).toBe(true);
    expect(Object.isFrozen(layout.geometry.columnX)).toBe(true);
    expect(Object.isFrozen(layout.geometry.emzX)).toBe(true);
    expect(Object.isFrozen(layout.zones)).toBe(true);
    expect([...layout.zones.values()].every(Object.isFrozen)).toBe(true);
  });
});
