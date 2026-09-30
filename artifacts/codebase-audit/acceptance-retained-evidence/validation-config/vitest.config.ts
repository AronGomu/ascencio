import { defineConfig } from "vitest/config";
import base from "../../vitest.config.ts";
export default defineConfig({ ...base, cacheDir: ".tmp/oracle-validation/vitest-cache" });
