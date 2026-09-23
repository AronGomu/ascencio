import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBundle } from "./lib/asset-delivery/verify-bundle.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const run = process.env.CONTENT_RUN;
if (!run)
  throw new Error(
    "CONTENT_RUN must name a verified private T3 run for legacy content browser gates",
  );
const snapshot = await verifyBundle(projectRoot, run);
if (snapshot.prod === null)
  throw new Error("CONTENT_RUN must include verified player content");

// t7-runtime.spec.ts still reads these legacy trees directly. Do not substitute
// a fixture or silently skip that suite when the private checkout lacks them.
for (const relative of [
  "generated/runtime/current/manifest.json",
  "generated/assets/current/manifest.json",
]) {
  try {
    if (!(await stat(path.join(projectRoot, relative))).isFile())
      throw new Error("Not a file");
  } catch {
    throw new Error(`Legacy content browser prerequisite missing: ${relative}`);
  }
}
console.log("Verified CONTENT_RUN and legacy content browser prerequisites");
