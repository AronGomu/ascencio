import { readFileSync, readdirSync } from "node:fs";
import { ESLint } from "eslint";
import { expect, it } from "vitest";

it("app-only browser sources remain in standard format, lint, typecheck and CI gates", async () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  for (const key of ["format", "format:check"])
    expect(pkg.scripts[key]).toContain('"e2e-core/**/*.ts"');
  expect(pkg.scripts.lint).toBe("eslint .");
  const lint = new ESLint();
  const sources = readdirSync("e2e-core").filter((name) =>
    name.endsWith(".ts"),
  );
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources)
    expect(await lint.isPathIgnored(`e2e-core/${source}`)).toBe(false);
  const config = JSON.parse(readFileSync("tsconfig.json", "utf8")) as {
    include: string[];
  };
  expect(config.include).toContain("e2e-core/**/*.ts");
  expect(pkg.scripts["check:headless"]).toContain("npm run format:check");
  expect(pkg.scripts["check:headless"]).toContain("npm run lint");
  expect(pkg.scripts["check:headless"]).toContain("npm run typecheck");
  expect(pkg.scripts.check).toContain("npm run check:headless");
  expect(readFileSync(".github/workflows/ci.yml", "utf8")).toMatch(
    /^\s+run: npm run check$/m,
  );
});
