import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("retired Shell ZIP installer API", () => {
  it("removes obsolete public schemas while retaining source authoring parsers", () => {
    expect(existsSync("src/content/index.ts")).toBe(false);
    for (const [file, name] of [
      ["chapter-selections", "parseChapterSelections"],
      ["chapter-story-document", "parseChapterStoryDocument"],
    ])
      expect(
        readFileSync(`scripts/lib/chapter-authoring/${file}.ts`, "utf8"),
      ).toContain(`export function ${name}`);
  });

  it("removes hosted bootstrap capability from CoreStartup", () => {
    const source = readFileSync("src/shell/core/core-gate.ts", "utf8");
    expect(source).not.toMatch(/ShellBootstrap|readonly bootstrap:/);
  });

  it("loads real-WASM integration through package queries, never a legacy browser runtime", () => {
    const source = readFileSync(
      "tests/integration/installed-runtime-wasm.test.ts",
      "utf8",
    );
    expect(source).not.toMatch(
      /exact-installed-runtime|legacy-battle-runtime|src\/content\//,
    );
    expect(source).toContain("package-runtime");
  });

  it("keeps app updates standalone without a content-actions fallback", () => {
    for (const file of [
      "src/shell/AppShell.svelte",
      "src/shell/screens/InstallContentScreen.svelte",
      "src/shell/application/application-bootstrap.ts",
    ])
      expect(readFileSync(file, "utf8")).not.toMatch(
        /contentActions|ContentActionsController/,
      );
  });
});
