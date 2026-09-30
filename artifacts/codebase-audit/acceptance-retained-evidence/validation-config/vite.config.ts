import { defineConfig } from "vite";
import base from "../../vite.config.ts";
export default defineConfig(async (env) => ({
  ...(await base(env)),
  cacheDir: ".tmp/oracle-validation/vite-cache",
}));
