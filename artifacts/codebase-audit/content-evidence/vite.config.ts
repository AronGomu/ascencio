import { defineConfig, mergeConfig } from "vite";
import config from "../../vite.config.ts";
export default defineConfig(async (env) => mergeConfig(await (config as Function)(env), {
  cacheDir: ".tmp/content-worker/vite-cache",
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ["/home/aron/Projects/ascencio"] } },
}));
