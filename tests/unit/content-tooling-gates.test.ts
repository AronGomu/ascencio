import { readFileSync, readdirSync } from "node:fs";
import { ESLint } from "eslint";
import { expect, it } from "vitest";
it("native build verifies the webview artifact without PWA tooling", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(pkg.scripts["frontend:bundle"]).toBe("vite build --mode native");
  expect(pkg.scripts["frontend:verify"]).toBe(
    "node scripts/verify-native-build.ts",
  );
  expect(pkg.scripts["test:content:legacy"]).toBeUndefined();
});

it("launch, build and browser hooks resolve every referenced npm command", () => {
  const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const hooks = [
    ...Object.values(scripts),
    readFileSync("src-tauri/tauri.conf.json", "utf8"),
    readFileSync("playwright.native.config.ts", "utf8"),
    readFileSync("playwright.acceptance.config.ts", "utf8"),
    readFileSync(".github/workflows/ci.yml", "utf8"),
  ];
  for (const hook of hooks)
    for (const [, name] of hook.matchAll(/npm run ([\w:-]+)/g))
      expect(scripts[name!], `Missing npm command: ${name}`).toBeTypeOf(
        "string",
      );
  expect(scripts["native:build-and-start:linux"]).toBe(
    "npm run native:desktop:build -- --no-bundle && ./src-tauri/target/release/ascencio",
  );
  expect(scripts["native:desktop:build"]).toBe("tauri build");
  expect(scripts["content:convert:sqlite-to-json"]).toBe(
    "node scripts/readable-content.ts convert",
  );
  expect(scripts["content:compile:json"]).toBe(
    "node scripts/readable-content.ts compile",
  );
});

it("app-only browser sources remain in standard format, lint, typecheck and CI gates", async () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  for (const key of ["format", "format:check"])
    expect(pkg.scripts[key]).toContain('"e2e/**/*.ts"');
  expect(pkg.scripts.lint).toBe("eslint .");
  const lint = new ESLint();
  const sources = readdirSync("e2e/e2e-native").filter((name) =>
    name.endsWith(".ts"),
  );
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources)
    expect(await lint.isPathIgnored(`e2e/e2e-native/${source}`)).toBe(false);
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
