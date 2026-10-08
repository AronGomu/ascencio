import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/e2e-native",
  outputDir: "generated/tests/native-webview",
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 45_000 },
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:4402", trace: "retain-on-failure" },
  projects: [
    {
      name: "webkit-compact",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 820, height: 600 },
      },
    },
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command:
      "npm run frontend:dev -- --mode native --host 127.0.0.1 --port 4402",
    url: "http://127.0.0.1:4402",
    reuseExistingServer: false,
    timeout: process.platform === "win32" ? 120_000 : 30_000,
  },
});
