import { describe, expect, it } from "vitest";
import {
  computeStageBox,
  selectStageMode,
  STAGE_BREAKPOINT_PX,
} from "../../src/shell/stage-layout.ts";

describe("computeStageBox", () => {
  it("1920x1080 is exact stage", () => {
    expect(computeStageBox(1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
      offsetX: 0,
      offsetY: 0,
      mode: "stage",
    });
  });

  it("1920x1200 gets horizontal bars", () => {
    const box = computeStageBox(1920, 1200);
    expect(box.mode).toBe("stage");
    expect(box.width).toBe(1920);
    expect(box.height).toBe(1080);
    expect(box.offsetX).toBe(0);
    expect(box.offsetY).toBe(60);
  });

  it("1280x600 gets vertical bars", () => {
    const box = computeStageBox(1280, 600);
    expect(box.mode).toBe("stage");
    expect(box.width).toBe(1066);
    expect(box.height).toBe(600);
    expect(box.offsetX).toBe(107);
    expect(box.offsetY).toBe(0);
  });

  it("1023x800 is mobile-landscape with a 16:9 box", () => {
    const box = computeStageBox(1023, 800);
    expect(box.mode).toBe("mobile-landscape");
    expect(box.width).toBe(1023);
    expect(box.height).toBe(575);
    expect(box.offsetX).toBe(0);
    expect(box.offsetY).toBe(112);
  });

  it("800x1000 is mobile-portrait filling the viewport", () => {
    expect(computeStageBox(800, 1000)).toEqual({
      width: 800,
      height: 1000,
      offsetX: 0,
      offsetY: 0,
      mode: "mobile-portrait",
    });
  });

  it("the exact breakpoint is stage", () => {
    expect(computeStageBox(STAGE_BREAKPOINT_PX, 768).mode).toBe("stage");
    expect(selectStageMode(1024, 768)).toBe("stage");
    expect(selectStageMode(1023, 768)).toBe("mobile-landscape");
  });

  it("invalid input is a frozen zero box", () => {
    for (const [width, height] of [
      [0, 0],
      [Number.NaN, 800],
      [1024, Number.NaN],
      [-1, 100],
      [Number.POSITIVE_INFINITY, 100],
    ] as const) {
      const box = computeStageBox(width, height);
      expect(box).toEqual({
        width: 0,
        height: 0,
        offsetX: 0,
        offsetY: 0,
        mode: "stage",
      });
      expect(Object.isFrozen(box)).toBe(true);
    }
  });

  it("every returned box is frozen", () => {
    expect(Object.isFrozen(computeStageBox(1920, 1080))).toBe(true);
    expect(Object.isFrozen(computeStageBox(800, 1000))).toBe(true);
    expect(Object.isFrozen(computeStageBox(1023, 800))).toBe(true);
  });
});
