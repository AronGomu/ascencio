import { defineConfig } from "@playwright/test";
import contentConfig from "./playwright.content.config.ts";

// These tests generate verified in-memory content; no private producer run or
// legacy generated/runtime + generated/assets trees are required.
export default defineConfig({
  ...contentConfig,
  testMatch: "**/installer.spec.ts",
});
