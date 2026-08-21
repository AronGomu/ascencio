import { describe, expect, it } from "vitest";
import {
  CARD_ASPECT,
  computeFieldGeometry,
  createFieldRenderLayout,
  ZONE_GAP,
} from "../../src/battle/field/duel-field-geometry.ts";
import { STANDARD_DUEL_FIELD_LAYOUT } from "../../src/battle/field/duel-field-layout.ts";

/* M2 2026-08-21: the first column is the middle-column budget
   `stage - --preview-w - --rail-min`, not a viewport. 1328 and 886 were the
   1920x1080 and 1366x768 budgets while `--preview-w` was 22rem/18rem; round 2
   narrowed it to 15.5rem/13.5rem (89faedf, ADR-042 §2), which makes them 1432
   and 958. Both expected sizes are unchanged because these EMZ fits are
   height-constrained, so the stale inputs were passing on luck. */
const budgets = [
  [1432, 1080, 1229, 1080],
  [1872, 1440, 1638, 1440],
  [958, 768, 874, 768],
] as const;

describe("duel field pixel geometry", () => {
  it.each(budgets)(
    "computes EMZ geometry from one scale factor at %sx%s",
    (availableWidth, availableHeight, width, height) => {
      const geometry = computeFieldGeometry(
        true,
        availableWidth,
        availableHeight,
      );
      expect(geometry.width).toBeCloseTo(width, 0);
      expect(geometry.height).toBeCloseTo(height, 0);
      expect(geometry.width).toBeLessThanOrEqual(availableWidth);
      expect(geometry.height).toBeLessThanOrEqual(availableHeight);
    },
  );

  it("fills the small no-EMZ viewport height on the narrowed preview budget", () => {
    /* M2 2026-08-21: was `(false, 886, 768)` -> 886x735, the 95.7% compromise
       ADR-019 §8 accepted while `--preview-w` was 18rem below 1500px. At
       13.5rem the budget is 958, so the fit stops being width-constrained and
       the board takes the whole viewport height. Chromium measures the width
       as 925.5625 in the acceptance run. */
    const geometry = computeFieldGeometry(false, 958, 768);
    expect(geometry.width).toBeCloseTo(925.57, 1);
    expect(geometry.height).toBeCloseTo(768, 0);
    expect(geometry.height / 768).toBeCloseTo(1, 3);
  });

  it.each([true, false])(
    "keeps absolute five-pixel gaps for profile %s",
    (extraMonsterZones) => {
      const geometry = computeFieldGeometry(extraMonsterZones, 1328, 1080);
      expect(geometry.pitch - geometry.box).toBe(ZONE_GAP);
      expect(geometry.columnX[1]! - geometry.columnX[0]!).toBeCloseTo(
        geometry.pitch,
      );
      expect(geometry.rowY[1]! - geometry.rowY[0]!).toBeCloseTo(geometry.pitch);
    },
  );

  it.each([true, false])(
    "makes square footprints and six-pixel slot pad for profile %s",
    (extraMonsterZones) => {
      const layout = createFieldRenderLayout(extraMonsterZones, 1328, 1080);
      expect(layout.geometry.cardHeight).toBe(layout.geometry.box);
      expect(layout.geometry.cardWidth).toBe(layout.geometry.box * CARD_ASPECT);
      expect(layout.geometry.slotWidth - layout.geometry.cardWidth).toBe(6);
      for (const [id, placement] of layout.zones) {
        expect(placement.height).toBe(layout.geometry.box);
        expect(placement.width).toBe(
          id.endsWith(":hand")
            ? layout.geometry.width - 2 * layout.geometry.margin
            : layout.geometry.box,
        );
      }
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

      const geometry = layout.geometry;
      expect(layout.zones.get("p1:hand")).toMatchObject({
        x: geometry.width / 2,
        y: geometry.rowY[0],
      });
      expect(layout.zones.get("p1:extra")).toMatchObject({
        x: geometry.columnX[0],
        y: geometry.rowY[1],
      });
      expect(layout.zones.get("p1:mainMonster:0")).toMatchObject({
        x: geometry.columnX[1],
        y: geometry.rowY[2],
      });
      expect(layout.zones.get("p0:mainMonster:4")).toMatchObject({
        x: geometry.columnX[5],
        y: geometry.rowY[extraMonsterZones ? 4 : 3],
      });
      expect(layout.zones.get("p0:graveyard")).toMatchObject({
        x: geometry.columnX[6],
        y: geometry.rowY[extraMonsterZones ? 4 : 3],
      });
      expect(layout.zones.get("p0:banished")).toMatchObject({
        x: geometry.columnX[7],
        y: geometry.rowY[extraMonsterZones ? 4 : 3],
      });
      if (extraMonsterZones) {
        expect(layout.zones.get("shared:extraMonster:left")).toMatchObject({
          x: geometry.emzX[0],
          y: geometry.rowY[3],
        });
        expect(layout.zones.get("shared:extraMonster:right")).toMatchObject({
          x: geometry.emzX[1],
          y: geometry.rowY[3],
        });
      } else {
        expect(layout.zones.has("shared:extraMonster:left")).toBe(false);
        expect(layout.zones.has("shared:extraMonster:right")).toBe(false);
      }
    },
  );

  it.each([
    [Number.NaN, 768],
    [Number.POSITIVE_INFINITY, 768],
    [886, Number.NEGATIVE_INFINITY],
    [0, 768],
    [-1, 768],
    [886, 0],
    [10, 10],
  ])(
    "returns finite empty geometry for invalid budget %s x %s",
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
      for (const value of Object.values(geometry).flatMap((value) =>
        typeof value === "number" ? [value] : value,
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
