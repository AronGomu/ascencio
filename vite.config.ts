import path from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, type UserConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { appBuildIdentity } from "./scripts/lib/app-build-identity.ts";
import { assertShellPrecacheEntries } from "./src/shell/pwa/shell-cache-policy.ts";
import {
  appAssetsPlugin,
  type AppBuildBoundary,
} from "./scripts/lib/vite-app-assets.ts";
import { contentSourceDenyPlugin } from "./scripts/lib/vite-content-deny.ts";
import { syncOnlyVendoredCorePlugin } from "./scripts/lib/vite-sync-core.ts";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }): UserConfig => {
  const nativeBuild = mode === "native";
  const developmentPort = Number(process.env.DEV_PORT ?? "4202");
  if (!Number.isSafeInteger(developmentPort) || developmentPort <= 0)
    throw new Error("DEV_PORT must be a positive integer");
  const appBuildDate = new Date().toISOString().slice(0, 10);
  const coreContentApiVersion = 1;
  const appBuildId = appBuildIdentity(projectRoot);
  const boundary: AppBuildBoundary = { base: "/", sqliteWasm: null };

  return {
    base: process.env.BASE_PATH ?? "/",
    /* Acquired content is CLI-only; app assets enter through explicit imports. */
    publicDir: false,
    server: {
      host: process.env.TAURI_DEV_HOST || false,
      port: developmentPort,
      strictPort: true,
      ...(process.env.TAURI_DEV_HOST
        ? { hmr: { protocol: "ws", host: process.env.TAURI_DEV_HOST } }
        : {}),
      watch: {
        ignored: ["**/.tmp/**"],
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
      ...(!nativeBuild
        ? [
            VitePWA({
              strategies: "injectManifest",
              srcDir: "src",
              filename: "service-worker.ts",
              injectRegister: false,
              registerType: "prompt",
              includeManifestIcons: false,
              manifest: {
                name: "YGO Story Duel Simulator",
                short_name: "YGO Story",
                description: "Offline Yu-Gi-Oh! story duel simulator",
                start_url: ".",
                scope: ".",
                display: "standalone",
                background_color: "#151126",
                theme_color: "#151126",
                icons: [
                  {
                    src: "app-icon.svg",
                    sizes: "any",
                    type: "image/svg+xml",
                    purpose: "any",
                  },
                ],
              },
              injectManifest: {
                manifestTransforms: [
                  async (entries) => {
                    if (boundary.sqliteWasm === null)
                      throw new Error(
                        "SQLite executable missing from app build",
                      );
                    const sqliteUrl = `${boundary.base}${boundary.sqliteWasm}`;
                    const prefixed = entries.map((entry) => ({
                      ...entry,
                      url: `${boundary.base}${entry.url}`,
                    }));
                    assertShellPrecacheEntries(prefixed, sqliteUrl);
                    if (!prefixed.some((entry) => entry.url === sqliteUrl))
                      throw new Error(
                        "SQLite executable missing from precache",
                      );
                    return { manifest: prefixed, warnings: [] };
                  },
                ],
                globPatterns: [
                  "**/*.{html,js,css,woff2}",
                  "assets/*.wasm",
                  "app-icon.svg",
                ],
                globIgnores: [
                  "content/**",
                  "runtime/**",
                  "__content/**",
                  "**/ocgcore*.wasm",
                  "**/*.zip",
                  "assets/story/**",
                ],
              },
            }),
          ]
        : []),
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
