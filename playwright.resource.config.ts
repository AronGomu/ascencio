import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: true,
  testDir: "./e2e/e2e-resource",
  outputDir: "generated/tests/resource/results",
  reporter: [
    ["line"],
    ["json", { outputFile: "generated/tests/resource/run.json" }],
  ],
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 45_000 },
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    baseURL: "http://127.0.0.1:4404",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium-resource" }],
  webServer: {
    command:
      "npm run vendor:verify && npm run content:source-manifest:verify && npm run frontend:bundle -- --outDir generated/build/resource && npm run frontend:preview -- --host 127.0.0.1 --port 4404 --strictPort --outDir generated/build/resource",
    url: "http://127.0.0.1:4404",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
