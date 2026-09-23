import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContentBuiltScratch } from "./lib/content-built-scratch.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

await createContentBuiltScratch(
  projectRoot,
  process.env.CONTENT_BUILT_TOKEN ?? "",
);
