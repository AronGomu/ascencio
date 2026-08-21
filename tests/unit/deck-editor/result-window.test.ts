import { describe, expect, it } from "vitest";
import {
  initialResultWindow,
  nextResultWindow,
} from "../../../src/deck-editor/layout/result-window.ts";

describe("initialResultWindow", () => {
  it("the first window is sixty or the whole list", () => {
    expect(initialResultWindow(200)).toBe(60);
    expect(initialResultWindow(12)).toBe(12);
  });
});

describe("nextResultWindow", () => {
  it("each step adds sixty up to the total", () => {
    expect(nextResultWindow(60, 200)).toBe(120);
    expect(nextResultWindow(180, 200)).toBe(200);
  });

  it("the window never exceeds the total", () => {
    expect(nextResultWindow(200, 200)).toBe(200);
  });
});
