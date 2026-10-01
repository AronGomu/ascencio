import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import type { Plugin, InlineConfig } from "vite";
import { syncOnlyVendoredCorePlugin } from "../../scripts/lib/vite-sync-core.ts";

const root = process.cwd();
function testAliases(worker = false): Plugin {
  return {
    name: "domain-fixture-only-aliases",
    enforce: "pre",
    resolveId(source, importer) {
      if (!worker && source.endsWith("/core-startup.ts"))
        return path.resolve(root, "tests/fixtures/selected-content-browser.ts");
      if (
        !worker &&
        source.endsWith("/json/browser-user-data.ts") &&
        importer?.endsWith("/create-storage-client.ts")
      )
        return path.resolve(root, "tests/fixtures/domain-user-json-faults.ts");
      return null;
    },
  };
}

/** Explicit opt-in build. Never merged into production Vite configuration. */
export function domainFixtureConfig(): InlineConfig {
  return {
    configFile: false,
    publicDir: false,
    base: "/ygo-story-duel/domain-fixture/app/",
    logLevel: "error",
    plugins: [testAliases(), syncOnlyVendoredCorePlugin(root), svelte()],
    define: {
      __RUNTIME_MANIFEST_SHA256__: "null",
      __RUNTIME_SNAPSHOT_ID__: "null",
      __ACTIVATION_SNAPSHOT_ID__: "null",
      __APP_BUILD_ID__: JSON.stringify("domain-fixture"),
      __APP_BUILD_DATE__: JSON.stringify("2026-09-24"),
      __CORE_CONTENT_API_VERSION__: "1",
      __ACTIVE_IMAGE_MANIFEST__: "null",
      __ACTIVE_IMAGE_MANIFEST_SHA256__: "null",
      __RUNTIME_REVISIONS__: "null",
    },
    build: {
      write: false,
      target: "esnext",
      rollupOptions: {
        input: path.resolve(root, "tests/fixtures/domain-main.ts"),
        output: { entryFileNames: "main.js" },
      },
    },
    worker: {
      format: "es",
      plugins: () => [testAliases(true), syncOnlyVendoredCorePlugin(root)],
    },
  };
}
