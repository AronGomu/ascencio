import { describe, expect, it } from "vitest";
import { fieldPlaneTransform } from "../../src/battle/field/perspective.ts";

describe("fieldPlaneTransform", () => {
  it("uses the default field camera and tilt", () => {
    expect(fieldPlaneTransform()).toBe("perspective(600px) rotateX(20deg)");
  });

  it("disables the transform for flat mode", () => {
    expect(fieldPlaneTransform(0, 600)).toBe("");
  });
});
