import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4203/ygo-story-duel/acceptance.html";

export default defineConfig({
  testDir: "./e2e-acceptance",
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
    command:
      "npm run vendor:verify && npm run snapshot:verify && ACCEPTANCE_SCENARIOS=1 npm run build:app -- --base=/ygo-story-duel/ && npm run preview -- --host 127.0.0.1 --port 4203 --strictPort --base=/ygo-story-duel/",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
