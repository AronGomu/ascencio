import { defineConfig } from "@playwright/test";
import base from "../../playwright.config.ts";
export default defineConfig({
  ...base,
  testDir: "../../e2e",
  use: { ...base.use, trace: "off", video: "off" },
  outputDir: `../../artifacts/oracle-validation/${process.env.ORACLE_RUN ?? "green"}`,
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --config .tmp/oracle-validation/vite.config.ts --host 127.0.0.1 --port 4518 --strictPort --base=/ygo-story-duel/",
    url: "http://127.0.0.1:4518/ygo-story-duel/",
    reuseExistingServer: false,
    timeout: 180_000,
    cwd: process.cwd(),
  },
});
