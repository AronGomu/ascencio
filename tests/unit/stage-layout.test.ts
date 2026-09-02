import { describe, expect, it } from "vitest";
import {
  computeStageBox,
  selectStageMode,
  STAGE_BREAKPOINT_PX,
} from "../../src/shell/stage-layout.ts";

describe("computeStageBox", () => {
  it("1920x1080 keeps a margin around the stage", () => {
    expect(computeStageBox(1920, 1080)).toEqual({
      width: 1891,
      height: 1064,
      offsetX: 14,
      offsetY: 8,
      mode: "stage",
      rotated: false,
    });
  });

  it("1920x1200 gets horizontal bars", () => {
    const box = computeStageBox(1920, 1200);
    expect(box.mode).toBe("stage");
    expect(box.width).toBe(1904);
    expect(box.height).toBe(1071);
    expect(box.offsetX).toBe(8);
    expect(box.offsetY).toBe(64);
  });

  it("1280x600 gets vertical bars", () => {
    const box = computeStageBox(1280, 600);
    expect(box.mode).toBe("stage");
    expect(box.width).toBe(1038);
    expect(box.height).toBe(584);
    expect(box.offsetX).toBe(121);
    expect(box.offsetY).toBe(8);
  });

  it("1023x800 is mobile-landscape with a 16:9 box", () => {
    const box = computeStageBox(1023, 800);
    expect(box.mode).toBe("mobile-landscape");
    expect(box.width).toBe(1007);
    expect(box.height).toBe(566);
    expect(box.offsetX).toBe(8);
    expect(box.offsetY).toBe(117);
  });

  it("800x1000 is mobile-portrait inside the stage margin", () => {
    expect(computeStageBox(800, 1000)).toEqual({
      width: 784,
      height: 984,
      offsetX: 8,
      offsetY: 8,
      mode: "mobile-portrait",
      rotated: true,
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
        rotated: false,
      });
      expect(Object.isFrozen(box)).toBe(true);
    }
  });

  /* Only a portrait viewport below the breakpoint plays the duel on a rotated
     stage; every other mode keeps the upright 16:9 box. The flag is what the
     shell mirrors onto `data-stage-rotated`, and the pixel numbers stay
     exactly what the stylesheet derives for `.app-stage` in each mode — the
     rotation is applied to the duel region inside the stage, not to the stage
     itself, so the deck editor keeps its own portrait layout (T14). */
  it("only mobile-portrait is rotated", () => {
    expect(computeStageBox(400, 900).rotated).toBe(true);
    expect(computeStageBox(400, 900).mode).toBe("mobile-portrait");
    expect(computeStageBox(900, 400).rotated).toBe(false);
    expect(computeStageBox(900, 400).mode).toBe("mobile-landscape");
    expect(computeStageBox(1600, 900).rotated).toBe(false);
    expect(computeStageBox(1600, 900).mode).toBe("stage");
    expect(computeStageBox(0, 0).rotated).toBe(false);
  });

  /* A square viewport is portrait by the same `height >= width` rule the
     stylesheet's `orientation: portrait` uses, so the two agree on the one
     input where a stricter `>` would not. */
  it("a square viewport below the breakpoint rotates", () => {
    expect(computeStageBox(600, 600).mode).toBe("mobile-portrait");
    expect(computeStageBox(600, 600).rotated).toBe(true);
  });

  it("every returned box is frozen", () => {
    expect(Object.isFrozen(computeStageBox(1920, 1080))).toBe(true);
    expect(Object.isFrozen(computeStageBox(800, 1000))).toBe(true);
    expect(Object.isFrozen(computeStageBox(1023, 800))).toBe(true);
  });
});
