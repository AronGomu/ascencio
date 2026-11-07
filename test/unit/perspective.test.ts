import { describe, expect, it } from "vitest";
import { fieldPlaneTransform } from "../../src/battle/field/perspective.ts";

describe("fieldPlaneTransform", () => {
  it("uses a flat camera for native webviews", () => {
    expect(fieldPlaneTransform()).toBe("");
  });

  it("disables the transform for flat mode", () => {
    expect(fieldPlaneTransform(0, 600)).toBe("");
  });
});
