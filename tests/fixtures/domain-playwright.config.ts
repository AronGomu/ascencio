import { defineConfig, devices } from "@playwright/test";

/** Isolated domain harness; no PWA/core package lifecycle scenarios. */
export default defineConfig({
  testDir: "../../e2e/e2e-global",
  testMatch: [
    "admin-console",
    "deck-editor",
    "deck-select-layout",
    "duel-portrait",
    "duel-smoke",
    "scrollbar-brand",
    "story",
    "story-duel",
    "story-header",
    "story-map",
    "story-shop",
    "story-stage-sizing",
  ].map((name) => `${name}.spec.ts`),
  outputDir: "../../generated/tests/domain-fixture/results",
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://127.0.0.1:4394/ygo-story-duel/",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node --input-type=module -e 'import { createServer } from "node:http"; createServer((req,res) => { res.end("Domain fixture routes owned by Playwright"); }).listen(4394,"127.0.0.1")'`,
    url: "http://127.0.0.1:4394",
    reuseExistingServer: false,
  },
});
