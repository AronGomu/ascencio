import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "../../e2e-core",
  outputDir: "../../artifacts/codebase-audit/core-test-results",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["line"]],
  use: { ...devices["Desktop Chrome"], trace: "on", screenshot: "on" },
  projects: [{ name: "chromium" }],
  webServer: {
    command: "node ../../../scripts/core-pwa-fixture-server.ts",
    cwd: new URL("./core", import.meta.url).pathname,
    url: "http://127.0.0.1:4400",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
