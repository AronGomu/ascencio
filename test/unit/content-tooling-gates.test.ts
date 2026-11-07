import { existsSync, readFileSync, readdirSync } from "node:fs";
import { ESLint } from "eslint";
import { expect, it } from "vitest";

it("launch, build and browser hooks resolve every referenced npm command", () => {
  const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const hooks = [
    ...Object.values(scripts),
    readFileSync("tauri/tauri.conf.json", "utf8"),
    readFileSync("test/config/playwright.native.config.ts", "utf8"),
    readFileSync("test/config/playwright.acceptance.config.ts", "utf8"),
    readFileSync("test/config/playwright.resource.config.ts", "utf8"),
  ];
  for (const hook of hooks)
    for (const [, name] of hook.matchAll(/npm run ([\w:-]+)/g))
      expect(scripts[name!], `Missing npm command: ${name}`).toBeTypeOf(
        "string",
      );
});

it("app-only browser sources remain in standard local format, lint and typecheck gates", async () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  for (const key of ["format", "format:check"])
    expect(pkg.scripts[key]).toContain('"test/**/*.{ts,svelte}"');
  expect(pkg.scripts.lint).toBe("eslint --config config/eslint.config.js .");
  const lint = new ESLint({ overrideConfigFile: "config/eslint.config.js" });
  const sources = readdirSync("test/e2e/native").filter((name) =>
    name.endsWith(".ts"),
  );
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources)
    expect(await lint.isPathIgnored(`test/e2e/native/${source}`)).toBe(false);
  const config = JSON.parse(readFileSync("config/tsconfig.json", "utf8")) as {
    include: string[];
  };
  expect(config.include).toContain("../test/**/*.ts");
  expect(config.include).toContain("../src/**/*.ts");
  expect(pkg.scripts.typecheck).toContain("--project config/tsconfig.json");
  expect(pkg.scripts["check:headless"]).toContain("npm run format:check");
  expect(pkg.scripts["check:headless"]).toContain("npm run lint");
  expect(pkg.scripts["check:headless"]).toContain("npm run typecheck");
  expect(pkg.scripts.check).toContain("npm run check:headless");
  expect(pkg.scripts.check).toContain("npm run check:frontend-and-browser");
});

it("keeps remote workflows outside GitHub's active workflow directory", () => {
  const workflows = existsSync(".github/workflows")
    ? readdirSync(".github/workflows").filter((name) => /\.ya?ml$/i.test(name))
    : [];
  expect(workflows).toEqual([]);
});
