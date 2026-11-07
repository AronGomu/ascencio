import path from "node:path";
import { projectRoot } from "./project-root.ts";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: true,
  testDir: "../../test/e2e/resources",
  outputDir: path.join(projectRoot, ".tmp/test/resource/results"),
  reporter: [
    ["line"],
    [
      "json",
      { outputFile: path.join(projectRoot, ".tmp/test/resource/run.json") },
    ],
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
    cwd: projectRoot,
    command:
      "npm run vendor:verify && npm run content:source-manifest:verify && npm run frontend:bundle -- --outDir .tmp/test/build/resource && npm run frontend:preview -- --host 127.0.0.1 --port 4404 --strictPort --outDir .tmp/test/build/resource",
    url: "http://127.0.0.1:4404",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
