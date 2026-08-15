import { describe, expect, it } from "vitest";
import { clampFieldWindowPosition } from "../../src/battle/app/presentation/floating-window-position.ts";

const BOUNDARY = { width: 800, height: 600 };
const WINDOW = { width: 200, height: 100 };

describe("clampFieldWindowPosition", () => {
  it("leaves an in-bounds position untouched", () => {
    expect(
      clampFieldWindowPosition({ x: 40, y: 50 }, BOUNDARY, WINDOW),
    ).toEqual({ x: 40, y: 50 });
  });

  it("pins a negative coordinate to the boundary origin", () => {
    expect(
      clampFieldWindowPosition({ x: -30, y: -1 }, BOUNDARY, WINDOW),
    ).toEqual({ x: 0, y: 0 });
  });

  it("keeps the whole border box inside the right and bottom edges", () => {
    expect(
      clampFieldWindowPosition({ x: 5000, y: 5000 }, BOUNDARY, WINDOW),
    ).toEqual({ x: 600, y: 500 });
  });

  it("allows the exact bottom-right corner", () => {
    expect(
      clampFieldWindowPosition({ x: 600, y: 500 }, BOUNDARY, WINDOW),
    ).toEqual({ x: 600, y: 500 });
  });

  it("pins an oversized axis to zero", () => {
    expect(
      clampFieldWindowPosition(
        { x: 120, y: 40 },
        { width: 100, height: 600 },
        WINDOW,
      ),
    ).toEqual({ x: 0, y: 40 });
    expect(
      clampFieldWindowPosition(
        { x: 40, y: 120 },
        { width: 800, height: 60 },
        WINDOW,
      ),
    ).toEqual({ x: 40, y: 0 });
  });

  it("normalizes nonfinite inputs to zero", () => {
    expect(
      clampFieldWindowPosition(
        { x: Number.NaN, y: Number.POSITIVE_INFINITY },
        BOUNDARY,
        WINDOW,
      ),
    ).toEqual({ x: 0, y: 0 });
    expect(
      clampFieldWindowPosition(
        { x: 40, y: 50 },
        { width: Number.NaN, height: 600 },
        { width: Number.NaN, height: 100 },
      ),
    ).toEqual({ x: 0, y: 50 });
  });

  it("returns a frozen object", () => {
    expect(
      Object.isFrozen(
        clampFieldWindowPosition({ x: 1, y: 2 }, BOUNDARY, WINDOW),
      ),
    ).toBe(true);
  });
});
