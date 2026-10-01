import path from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, type UserConfig } from "vite";
import { appBuildIdentity } from "./scripts/lib/app-build-identity.ts";
import {
  appAssetsPlugin,
  type AppBuildBoundary,
} from "./scripts/lib/vite-app-assets.ts";
import { contentSourceDenyPlugin } from "./scripts/lib/vite-content-deny.ts";
import { syncOnlyVendoredCorePlugin } from "./scripts/lib/vite-sync-core.ts";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig((): UserConfig => {
  const developmentPort = Number(process.env.DEV_PORT ?? "4204");
  if (!Number.isSafeInteger(developmentPort) || developmentPort <= 0)
    throw new Error("DEV_PORT must be a positive integer");
  const appBuildDate = new Date().toISOString().slice(0, 10);
  const coreContentApiVersion = 1;
  const appBuildId = appBuildIdentity(projectRoot);
  const boundary: AppBuildBoundary = { base: "/" };

  return {
    base: process.env.BASE_PATH ?? "/",
    /* Acquired content is CLI-only; app assets enter through explicit imports. */
    publicDir: false,
    server: {
      host: process.env.TAURI_DEV_HOST || "127.0.0.1",
      port: developmentPort,
      strictPort: true,
      ...(process.env.TAURI_DEV_HOST
        ? { hmr: { protocol: "ws", host: process.env.TAURI_DEV_HOST } }
        : {}),
      watch: {
        ignored: [
          "**/.tmp/**",
          "**/generated/**",
          "**/artifacts/**",
          "**/src-tauri/target/**",
          "**/src-tauri/resources/**",
        ],
      },
    },
    preview: {
      port: developmentPort,
      strictPort: true,
    },
    plugins: [
      syncOnlyVendoredCorePlugin(projectRoot),
      svelte(),
      contentSourceDenyPlugin(projectRoot),
      appAssetsPlugin(projectRoot, appBuildId, coreContentApiVersion, boundary),
    ],
    define: {
      __RUNTIME_MANIFEST_SHA256__: "null",
      __RUNTIME_SNAPSHOT_ID__: "null",
      __ACTIVATION_SNAPSHOT_ID__: "null",
      __APP_BUILD_ID__: JSON.stringify(appBuildId),
      __APP_BUILD_DATE__: JSON.stringify(appBuildDate),
      __CORE_CONTENT_API_VERSION__: JSON.stringify(coreContentApiVersion),
      __ACTIVE_IMAGE_MANIFEST__: "null",
      __ACTIVE_IMAGE_MANIFEST_SHA256__: "null",
      __RUNTIME_REVISIONS__: "null",
    },
    build: {
      outDir: "generated/build/app",
      target: "es2023",
      manifest: true,
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        preserveEntrySignatures: "exports-only",
        /* Product ships one document. Acceptance harness stays opt-in. */
        input:
          process.env.ACCEPTANCE_SCENARIOS === "1"
            ? {
                index: path.join(projectRoot, "index.html"),
                acceptance: path.join(projectRoot, "acceptance.html"),
              }
            : {
                app: path.join(projectRoot, "index.html"),
                storage: path.join(
                  projectRoot,
                  "src/storage/create-storage-client.ts",
                ),
              },
      },
    },
    worker: {
      format: "es",
      plugins: () => [syncOnlyVendoredCorePlugin(projectRoot)],
    },
  };
});
