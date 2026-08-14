import { describe, expect, it } from "vitest";
import {
  isQuarterTurnClockwise,
  readStageFrame,
  toFrameDelta,
  toFramePoint,
  toFrameRect,
  UNROTATED_FRAME,
  type StageFrame,
} from "../../src/app/presentation/stage-frame.ts";

/* A 390x844 phone: the rotated duel frame is 693.33x390 in its own space, so
   on screen it is 390 wide and 693.33 tall, centred vertically. */
const FRAME_WIDTH = 693.33;
const VIEWPORT_WIDTH = 390;
const VIEWPORT_HEIGHT = 844;
const FRAME_TOP = (VIEWPORT_HEIGHT - FRAME_WIDTH) / 2;
const ROTATED: StageFrame = Object.freeze({
  rotated: true,
  top: FRAME_TOP,
  right: VIEWPORT_WIDTH,
});

/** The quarter turn the browser applies, so a test can prove the mapping is a
    real inverse instead of restating it. */
function toViewportPoint(
  frame: StageFrame,
  x: number,
  y: number,
): { x: number; y: number } {
  if (!frame.rotated) return { x, y };
  return { x: frame.right - y, y: frame.top + x };
}

describe("isQuarterTurnClockwise", () => {
  it("accepts the stylesheet's clockwise quarter turn with any translation", () => {
    expect(isQuarterTurnClockwise("matrix(0, 1, -1, 0, 0, 0)")).toBe(true);
    expect(isQuarterTurnClockwise("matrix(0, 1, -1, 0, -346.5, -195)")).toBe(
      true,
    );
  });

  it("rejects no transform, a plain translation and the opposite turn", () => {
    expect(isQuarterTurnClockwise("none")).toBe(false);
    expect(isQuarterTurnClockwise("")).toBe(false);
    expect(isQuarterTurnClockwise("matrix(1, 0, 0, 1, -50, -50)")).toBe(false);
    expect(isQuarterTurnClockwise("matrix(0, -1, 1, 0, 0, 0)")).toBe(false);
    expect(isQuarterTurnClockwise("matrix(-1, 0, 0, -1, 0, 0)")).toBe(false);
    expect(isQuarterTurnClockwise("matrix3d(0, 1, 0, 0)")).toBe(false);
  });
});

describe("readStageFrame", () => {
  it("is unrotated with no element and outside the shell's duel region", () => {
    expect(readStageFrame(null)).toBe(UNROTATED_FRAME);
    const orphan = {
      closest: () => null,
    } as unknown as Element;
    expect(readStageFrame(orphan)).toBe(UNROTATED_FRAME);
  });
});

describe("the unrotated frame is the identity", () => {
  it("leaves points, deltas and rects exactly as the viewport reports them", () => {
    expect(toFramePoint(UNROTATED_FRAME, 120, 340)).toEqual({
      x: 120,
      y: 340,
    });
    expect(toFrameDelta(UNROTATED_FRAME, -12, 8)).toEqual({ x: -12, y: 8 });
    expect(
      toFrameRect(UNROTATED_FRAME, {
        left: 10,
        top: 20,
        width: 30,
        height: 40,
      }),
    ).toEqual({ left: 10, top: 20, width: 30, height: 40 });
  });
});

describe("the rotated frame", () => {
  it("maps the four corners of the on-screen box onto the frame's own corners", () => {
    // Screen top-right is the frame's origin; screen top-left is its
    // bottom-left, because the frame is turned clockwise.
    expect(toFramePoint(ROTATED, VIEWPORT_WIDTH, FRAME_TOP)).toEqual({
      x: 0,
      y: 0,
    });
    expect(toFramePoint(ROTATED, 0, FRAME_TOP)).toEqual({
      x: 0,
      y: VIEWPORT_WIDTH,
    });
    const bottomRight = toFramePoint(
      ROTATED,
      VIEWPORT_WIDTH,
      FRAME_TOP + FRAME_WIDTH,
    );
    expect(bottomRight.x).toBeCloseTo(FRAME_WIDTH, 6);
    expect(bottomRight.y).toBeCloseTo(0, 6);
  });

  it("is the exact inverse of the turn the browser applies", () => {
    for (const [x, y] of [
      [0, 0],
      [195, 422],
      [389, 843],
      [12.5, 300.25],
    ] as const) {
      const framePoint = toFramePoint(ROTATED, x, y);
      const back = toViewportPoint(ROTATED, framePoint.x, framePoint.y);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });

  /* A finger moving down the screen moves the board to its right, so a raw
     viewport delta written straight into the frame drags a window along the
     wrong axis. */
  it("turns a viewport delta a quarter turn too", () => {
    const down = toFrameDelta(ROTATED, 0, 20);
    expect(down.x).toBeCloseTo(20, 6);
    expect(down.y).toBeCloseTo(0, 6);
    expect(toFrameDelta(ROTATED, 20, 0)).toEqual({ x: 0, y: -20 });
    expect(toFrameDelta(ROTATED, -6, 9)).toEqual({ x: 9, y: 6 });
  });

  it("swaps the axes of a rectangle and keeps it inside the frame", () => {
    // A 60x90 card whose on-screen box sits near the top-left of the phone.
    const rect = { left: 20, top: FRAME_TOP + 100, width: 60, height: 90 };
    const frameRect = toFrameRect(ROTATED, rect);
    expect(frameRect).toEqual({
      left: 100,
      top: VIEWPORT_WIDTH - 80,
      width: 90,
      height: 60,
    });
    // The frame-space corner maps back to the on-screen corner it came from.
    const corner = toViewportPoint(ROTATED, frameRect.left, frameRect.top);
    expect(corner.x).toBeCloseTo(rect.left + rect.width, 6);
    expect(corner.y).toBeCloseTo(rect.top, 6);
  });
});
