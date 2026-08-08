import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global styles", () => {
  it("declares a global .visually-hidden clip utility", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).toContain(".visually-hidden");
    expect(css).toContain("clip: rect(0 0 0 0)");
  });
});
