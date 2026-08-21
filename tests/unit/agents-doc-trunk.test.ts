import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* T1: the repo's own instruction file must describe trunk development, and the
   machine-enforced import boundaries must survive the topology change. */
describe("AGENTS.md branch model", () => {
  const agents = readFileSync("AGENTS.md", "utf8");

  it("names main as the only long-lived branch", () => {
    expect(agents).toContain("single long-lived branch");
    expect(agents).not.toMatch(/worktree lanes/i);
    expect(agents).not.toMatch(/Branch ownership/);
  });

  it("keeps the machine-enforced boundary section", () => {
    expect(agents).toContain("tests/unit/domain-boundaries.test.ts");
    expect(agents).toContain("no-restricted-imports");
  });
});

describe("ADR-045", () => {
  it("supersedes only the topology half of ADR-022", () => {
    const adr = readFileSync(
      "docs/ADR/045_ADR_single_branch_trunk_development.md",
      "utf8",
    );

    expect(adr).toContain("ADR-022");
    expect(adr).toContain("topology");
    expect(adr).toContain("import boundaries are unaffected");
  });
});
