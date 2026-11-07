import path from "node:path";
import { projectRoot } from "./project-root.ts";
import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4203/ygo-story-duel/acceptance.html";

export default defineConfig({
  forbidOnly: true,
  testDir: "../../test/e2e/acceptance",
  outputDir: path.join(projectRoot, ".tmp/test/e2e-acceptance/results"),
  reporter: [
    ["line"],
    [
      "html",
      {
        outputFolder: path.join(projectRoot, ".tmp/test/e2e-acceptance/report"),
      },
    ],
  ],
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    cwd: projectRoot,
    env: { ACCEPTANCE_SCENARIOS: "1" },
    command:
      "npm run vendor:verify && npm run content:source-manifest:verify && npm run frontend:bundle -- --base=/ygo-story-duel/ --outDir .tmp/test/build/acceptance && npm run frontend:preview -- --host 127.0.0.1 --port 4203 --strictPort --base=/ygo-story-duel/ --outDir .tmp/test/build/acceptance",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
