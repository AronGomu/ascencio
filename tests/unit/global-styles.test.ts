import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global styles", () => {
  it("declares a global .visually-hidden clip utility", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).toContain(".visually-hidden");
    expect(css).toContain("clip: rect(0 0 0 0)");
  });

  it("duel field does not contain overscroll", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = duelFieldBlock(css);
    expect(block).not.toContain("overscroll-behavior: contain");
    expect(block).not.toContain("overflow: auto");
  });

  it("duel field is not height-capped on small screens", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).not.toContain("max-height: calc(100svh - 1rem)");
  });

  it("board is full width", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = ruleBlock(css, ".duel-field-board {");
    expect(block).toContain("width: 100%");
    expect(block).not.toContain("calc((100vh - 4rem) * 16 / 9)");
  });

  it("board keeps a min-width that holds field targets at 44px", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(ruleBlock(css, ".duel-field-board {")).toContain("min-width: 52rem");
    expect(duelFieldBlock(css)).toContain("overflow-x: auto");
  });

  it("the actionable halo is orange", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = ruleBlock(
      css,
      ".duel-field-zone.is-actionable,\n.duel-field-card.is-actionable .duel-field-card__art {",
    );
    expect(block).toContain("border-color: var(--warning)");
    expect(block).not.toContain("--accent");
  });

  it("opponent hand zone is plain", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).toContain(
      '.duel-field-zone[data-zone-id="p1:hand"] {\n  border-color: transparent;\n  background: transparent;\n}',
    );
  });
});

function ruleBlock(css: string, selectorStart: string): string {
  const start = css.indexOf(selectorStart);
  if (start === -1) throw new Error(`Selector not found: ${selectorStart}`);
  const end = css.indexOf("}", start);
  return css.slice(start, end + 1);
}

function duelFieldBlock(css: string): string {
  return ruleBlock(css, ".duel-field {");
}
