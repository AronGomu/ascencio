import { describe, expect, it } from "vitest";
import {
  initialResultWindow,
  nextResultWindow,
  RESULT_WINDOW_CEILING,
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

describe("nextResultWindow ceiling", () => {
  it("the window never exceeds the ceiling", () => {
    // 240 + 60 = 300, but that's the ceiling, not 300
    expect(nextResultWindow(240, 15000)).toBe(RESULT_WINDOW_CEILING);
    // already at ceiling → stays at ceiling
    expect(nextResultWindow(300, 15000)).toBe(RESULT_WINDOW_CEILING);
    // way past what ceiling would allow
    expect(nextResultWindow(RESULT_WINDOW_CEILING, 100000)).toBe(RESULT_WINDOW_CEILING);
  });

  it("ceiling is 300", () => {
    expect(RESULT_WINDOW_CEILING).toBe(300);
  });
});
