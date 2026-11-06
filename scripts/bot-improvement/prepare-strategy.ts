import { build } from "esbuild";
import { resolve } from "node:path";
const destination = process.argv[2];
if (!destination)
  throw new Error(
    "Usage: node scripts/bot-improvement/prepare-strategy.ts OUTPUT.mjs",
  );
await build({
  stdin: {
    contents:
      'export { baselineStrategy as createStrategy } from "./src/battle/worker/bot/generalist-strategy.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: resolve(destination),
});
