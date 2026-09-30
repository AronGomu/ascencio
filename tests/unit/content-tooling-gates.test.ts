import { readFileSync, readdirSync } from "node:fs";
import { ESLint } from "eslint";
import { expect, it } from "vitest";
import fixtureConfig from "../../playwright.content-fixture.config.ts";

it("standard browser gate executes core and deterministic content suites; private suites stay explicit", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  expect(pkg.scripts.check).toContain("npm run check:browser");
  expect(pkg.scripts["check:browser"]).toContain("npm run test:core");
  expect(pkg.scripts["test:core"]).toBe(
    "playwright test -c playwright.core.config.ts --project=chromium",
  );
  expect(pkg.scripts["check:browser"]).toContain(
    "npm run test:content:fixtures",
  );
  expect(pkg.scripts["test:content:fixtures"]).toBe(
    "playwright test -c playwright.content-fixture.config.ts",
  );
  expect(pkg.scripts["test:content:legacy"]).toBe(
    "node scripts/verify-content-browser-run.ts && playwright test -c playwright.content.config.ts && playwright test -c playwright.content-built.config.ts && playwright test -c playwright.t3.config.ts",
  );
  expect(pkg.scripts["check:browser"]).not.toContain("test:content:legacy");
  expect(fixtureConfig.testMatch).toBe("**/installer.spec.ts");
  expect(fixtureConfig.testDir).toBe("./e2e-content");
});

it("app-only browser sources remain in standard format, lint, typecheck and CI gates", async () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  for (const key of ["format", "format:check"])
    expect(pkg.scripts[key]).toContain('"e2e/**/*.ts"');
  expect(pkg.scripts.lint).toBe("eslint .");
  const lint = new ESLint();
  const sources = readdirSync("e2e/e2e-core").filter((name) =>
    name.endsWith(".ts"),
  );
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources)
    expect(await lint.isPathIgnored(`e2e/e2e-core/${source}`)).toBe(false);
  const config = JSON.parse(readFileSync("tsconfig.json", "utf8")) as {
    include: string[];
  };
  expect(config.include).toContain("e2e/**/*.ts");
  expect(pkg.scripts["check:headless"]).toContain("npm run format:check");
  expect(pkg.scripts["check:headless"]).toContain("npm run lint");
  expect(pkg.scripts["check:headless"]).toContain("npm run typecheck");
  expect(pkg.scripts.check).toContain("npm run check:headless");
  expect(readFileSync(".github/workflows/ci.yml", "utf8")).toMatch(
    /^\s+run: npm run check$/m,
  );
});
