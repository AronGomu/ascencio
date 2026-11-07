import { projectRoot } from "./project-root.ts";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: projectRoot,
  cacheDir: ".tmp/test/cache/vite",
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: "node",
    // Node 26 globals shadow JSDOM storage before environment setup.
    execArgv: ["--no-experimental-webstorage"],
    include: ["test/{unit,integration,component}/**/*.test.ts"],
    setupFiles: ["test/fixtures/runtime-build-constants.ts"],
    // Filesystem-heavy fixtures take longer on Windows; bound worker pressure.
    ...(process.platform === "win32" ? { maxWorkers: 2 } : {}),
    testTimeout: process.platform === "win32" ? 120_000 : 30_000,
    hookTimeout: process.platform === "win32" ? 120_000 : 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: ".tmp/test/coverage",
    },
  },
});
