import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/styles/app.css", "utf8");

describe("shared dialog chrome", () => {
  it("uses the VariantB panel values without legacy or backdrop styles", () => {
    const panel = ruleBlock(".dialog-panel {");

    expect(panel).toContain("background: var(--surface-panel)");
    expect(panel).toContain("border: 1px solid var(--gold-line)");
    expect(panel).toContain("border-radius: 0");
    expect(panel).toContain("clip-path: polygon(");
    expect(panel).toContain("var(--chamfer)");
    expect(panel).toContain("box-shadow: none");
    expect(panel).not.toContain("border-radius: var(--radius-lg)");
    expect(panel).not.toContain("var(--surface-strong)");
    expect(panel).not.toContain("backdrop-filter");
  });

  it("keeps blur on the backdrop instead of the chamfered panel", () => {
    const backdrop = ruleBlock(".dialog-backdrop {");

    expect(backdrop).toContain("backdrop-filter: blur(12px)");
    expect(backdrop).not.toContain("clip-path");
  });

  it("gives loading status text the gold Forum treatment without a chamfer", () => {
    const overlay = ruleBlock(".loading-overlay {");
    const status = ruleBlock(".loading-overlay p {");

    expect(overlay).not.toContain("clip-path");
    expect(status).toContain("font-family: var(--font-display)");
    expect(status).toContain("font-weight: 400");
    expect(status).toContain("letter-spacing: var(--ls-display)");
    expect(status).toContain("text-transform: uppercase");
    expect(status).toContain("color: var(--accent)");
  });

  it("preserves result and error title semantics", () => {
    const result = ruleBlock(".duel-result-dialog-title {");
    const error = ruleBlock(".duel-error-dialog-title {");

    expect(result).toContain("color: var(--accent)");
    expect(result).toContain("text-shadow:");
    expect(error).toContain("color: var(--danger)");
  });
});

function ruleBlock(selector: string): string {
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`Selector not found: ${selector}`);
  const end = CSS.indexOf("}", start);
  return CSS.slice(start, end + 1);
}
