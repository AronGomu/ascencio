import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const collections = [
  { directory: "e2e-native", config: "playwright.native.config.ts" },
  { directory: "e2e-acceptance", config: "playwright.acceptance.config.ts" },
  { directory: "e2e-resource", config: "playwright.resource.config.ts" },
];
const legacySpecs = [
  "deck-editor",
  "deck-select-layout",
  "duel-smoke",
  "story-duel",
  "story-header",
  "story-map",
  "story-shop",
  "story-stage-sizing",
  "story",
].map((name) => path.resolve("e2e/e2e-global", `${name}.spec.ts`));
const accountedFiles = new Set(legacySpecs);
const reports = [];
for (const { directory, config } of collections) {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      config,
      "--list",
      "--forbid-only",
      "--reporter=./scripts/lib/browser-collection-reporter.ts",
    ],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, `${config}: ${result.error ?? result.stderr}`);
  const cases: unknown = JSON.parse(result.stdout);
  assert(
    Array.isArray(cases) && cases.length > 0,
    `${config} collected no cases`,
  );
  const files = new Set<string>();
  for (const entry of cases) {
    assert(
      entry && typeof entry === "object" && typeof entry.file === "string",
    );
    assert.notEqual(
      entry.expectedStatus,
      "skipped",
      `${entry.title} is skipped`,
    );
    files.add(path.resolve(entry.file));
    accountedFiles.add(path.resolve(entry.file));
  }
  const root = path.resolve("e2e", directory);
  const expected = (await readdir(root, { recursive: true }))
    .filter((file) => file.endsWith(".spec.ts"))
    .map((file) => path.resolve(root, file));
  assert.deepEqual(
    [...files].sort(),
    expected.sort(),
    `${config} omitted a spec`,
  );
  reports.push({
    config,
    files: files.size,
    cases: cases.length,
    tests: cases,
  });
  console.log(`${config}: ${cases.length} cases in ${files.size} files`);
}
const allSpecs = (await readdir("e2e", { recursive: true }))
  .filter((file) => file.endsWith(".spec.ts"))
  .map((file) => path.resolve("e2e", file));
assert.deepEqual(
  [...accountedFiles].sort(),
  allSpecs.sort(),
  "Every browser spec must be collected or explicitly recorded as a legacy browser spec",
);
await mkdir("generated/tests", { recursive: true });
await writeFile(
  "generated/tests/browser-collection.json",
  JSON.stringify({ active: reports, legacyUncollected: legacySpecs }, null, 2) +
    "\n",
);
