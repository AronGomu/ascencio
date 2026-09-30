import { defineConfig } from "@playwright/test";
import config from "../../playwright.content.config.ts";
export default defineConfig({
  ...config,
  testDir: "../../e2e-content",
  webServer: {
    ...config.webServer,
    command: "npx vite --config .tmp/content-worker/vite.config.ts --host 127.0.0.1 --port 4402 --strictPort",
    cwd: process.cwd(),
    url: "http://127.0.0.1:4402",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
