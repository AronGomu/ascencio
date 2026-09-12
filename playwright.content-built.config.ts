import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-content",
  testMatch: "built-installer.spec.ts",
  globalTeardown: "./scripts/content-built-teardown.ts",
  outputDir: "artifacts/CORE_ACCEPTANCE/T6/built-test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: "artifacts/CORE_ACCEPTANCE/T6/built-playwright-report.json",
      },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    trace: "on",
    screenshot: "on",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
  webServer: [
    {
      command:
        "npm run build && npx vite preview --host 127.0.0.1 --port 4403 --strictPort",
      url: "http://127.0.0.1:4403/",
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command:
        "env BASE_PATH=/ygo-story-duel/ sh -c 'npm run build:app -- --outDir .tmp/t6-installed-built-subpath && npx vite preview --outDir .tmp/t6-installed-built-subpath --host 127.0.0.1 --port 4404 --strictPort'",
      url: "http://127.0.0.1:4404/ygo-story-duel/",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
