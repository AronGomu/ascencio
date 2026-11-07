import { describe, expect, it } from "vitest";
import {
  dragFrameForPointer,
  dragGhostSettled,
  settleDragGhostFrame,
  DRAG_GHOST_MAX_TILT_DEGREES,
  type CardDragOrigin,
  type DragGhostFrame,
  type DragPointerSample,
} from "../../src/battle/app/presentation/drag-ghost-physics.ts";

const ORIGIN: CardDragOrigin = Object.freeze({
  pointer: { x: 100, y: 100, timeMs: 0 },
  sourceLeft: 80,
  sourceTop: 80,
  width: 72,
  height: 104,
  pointerOffsetX: 20,
  pointerOffsetY: 20,
  imageUrl: "card.png",
});

const ZERO_FRAME: DragGhostFrame = Object.freeze({
  x: 80,
  y: 80,
  velocityX: 0,
  velocityY: 0,
  tiltDegrees: 0,
});

function sample(x: number, y: number, timeMs: number): DragPointerSample {
  return { x, y, timeMs };
}

describe("dragFrameForPointer", () => {
  it("gives exact x/y as cursor minus grab offset", () => {
    const frame = dragFrameForPointer(
      ZERO_FRAME,
      sample(100, 100, 0),
      sample(150, 130, 16),
      ORIGIN,
    );
    expect(frame.x).toBe(150 - ORIGIN.pointerOffsetX);
    expect(frame.y).toBe(130 - ORIGIN.pointerOffsetY);
  });

  it("rightward velocity gives positive tilt", () => {
    const frame = dragFrameForPointer(
      ZERO_FRAME,
      sample(100, 100, 0),
      sample(150, 100, 16),
      ORIGIN,
    );
    expect(frame.tiltDegrees).toBeGreaterThan(0);
  });

  it("leftward velocity gives negative tilt", () => {
    const frame = dragFrameForPointer(
      ZERO_FRAME,
      sample(100, 100, 0),
      sample(50, 100, 16),
      ORIGIN,
    );
    expect(frame.tiltDegrees).toBeLessThan(0);
  });

  it("clamps extreme velocity to ±10deg", () => {
    const frame = dragFrameForPointer(
      ZERO_FRAME,
      sample(0, 0, 0),
      sample(10000, 0, 1),
      ORIGIN,
    );
    expect(frame.tiltDegrees).toBe(DRAG_GHOST_MAX_TILT_DEGREES);

    const other = dragFrameForPointer(
      ZERO_FRAME,
      sample(10000, 0, 0),
      sample(0, 0, 1),
      ORIGIN,
    );
    expect(other.tiltDegrees).toBe(-DRAG_GHOST_MAX_TILT_DEGREES);
  });

  it("returns finite values for a same timestamp sample", () => {
    const frame = dragFrameForPointer(
      ZERO_FRAME,
      sample(100, 100, 16),
      sample(120, 100, 16),
      ORIGIN,
    );
    expect(Number.isFinite(frame.x)).toBe(true);
    expect(Number.isFinite(frame.y)).toBe(true);
    expect(Number.isFinite(frame.velocityX)).toBe(true);
    expect(Number.isFinite(frame.tiltDegrees)).toBe(true);
  });

  it("returns finite values for a backward timestamp sample", () => {
    const frame = dragFrameForPointer(
      ZERO_FRAME,
      sample(100, 100, 32),
      sample(120, 100, 16),
      ORIGIN,
    );
    expect(Number.isFinite(frame.x)).toBe(true);
    expect(Number.isFinite(frame.velocityX)).toBe(true);
    expect(Number.isFinite(frame.tiltDegrees)).toBe(true);
  });

  it("caps a huge tab-resume delta at the frame cap so velocity does not spike", () => {
    const normal = dragFrameForPointer(
      ZERO_FRAME,
      sample(100, 100, 0),
      sample(116, 100, 16),
      ORIGIN,
    );
    const resumed = dragFrameForPointer(
      ZERO_FRAME,
      sample(100, 100, 0),
      sample(116, 100, 5000),
      ORIGIN,
    );
    /* Pointer-move velocity itself is not capped by the 32ms constant (that
       cap is spring-integration only), but it must stay finite and small for
       a huge dt rather than exploding. */
    expect(Number.isFinite(resumed.velocityX)).toBe(true);
    expect(Math.abs(resumed.velocityX)).toBeLessThan(
      Math.abs(normal.velocityX),
    );
  });

  it("returns a frozen object", () => {
    const frame = dragFrameForPointer(
      ZERO_FRAME,
      sample(100, 100, 0),
      sample(120, 100, 16),
      ORIGIN,
    );
    expect(Object.isFrozen(frame)).toBe(true);
  });
});

describe("settleDragGhostFrame", () => {
  const target = { x: 200, y: 200 };

  it("reduces distance to target over repeated frames without growing amplitude", () => {
    let frame: DragGhostFrame = {
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      tiltDegrees: 5,
    };
    const previousDistance = Math.hypot(target.x - frame.x, target.y - frame.y);
    let maxDistance = previousDistance;
    for (let i = 0; i < 60; i += 1) {
      frame = settleDragGhostFrame(frame, target, 16);
      const distance = Math.hypot(target.x - frame.x, target.y - frame.y);
      maxDistance = Math.max(maxDistance, distance);
    }
    const finalDistance = Math.hypot(target.x - frame.x, target.y - frame.y);
    expect(finalDistance).toBeLessThan(previousDistance);
    expect(maxDistance).toBeLessThanOrEqual(previousDistance + 1e-6);
  });

  it("settles to within tolerance eventually", () => {
    let frame: DragGhostFrame = {
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      tiltDegrees: 5,
    };
    for (let i = 0; i < 200; i += 1) {
      frame = settleDragGhostFrame(frame, target, 16);
    }
    expect(dragGhostSettled(frame, target)).toBe(true);
  });

  it("caps a huge elapsed delta at 32ms so a tab resume does not overshoot", () => {
    const frame: DragGhostFrame = {
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      tiltDegrees: 0,
    };
    const capped = settleDragGhostFrame(frame, target, 32);
    const hugeGap = settleDragGhostFrame(frame, target, 5000);
    expect(hugeGap).toEqual(capped);
  });

  it("returns a frozen object", () => {
    const frame = settleDragGhostFrame(ZERO_FRAME, target, 16);
    expect(Object.isFrozen(frame)).toBe(true);
  });
});

describe("dragGhostSettled", () => {
  const target = { x: 100, y: 100 };

  it("is false when near position but still fast", () => {
    const frame: DragGhostFrame = {
      x: 100.1,
      y: 100,
      velocityX: 50,
      velocityY: 0,
      tiltDegrees: 0,
    };
    expect(dragGhostSettled(frame, target)).toBe(false);
  });

  it("is false when slow but still far", () => {
    const frame: DragGhostFrame = {
      x: 90,
      y: 100,
      velocityX: 0,
      velocityY: 0,
      tiltDegrees: 0,
    };
    expect(dragGhostSettled(frame, target)).toBe(false);
  });

  it("is true only when both distance and speed are within tolerance", () => {
    const frame: DragGhostFrame = {
      x: 100.2,
      y: 99.9,
      velocityX: 3,
      velocityY: -2,
      tiltDegrees: 0,
    };
    expect(dragGhostSettled(frame, target)).toBe(true);
  });
});
