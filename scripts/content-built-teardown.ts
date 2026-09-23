import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeContentBuiltScratch } from "./lib/content-built-scratch.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export default async function teardownContentBuilt(): Promise<void> {
  const token = process.env.CONTENT_BUILT_TOKEN;
  if (token === undefined) return;
  await removeContentBuiltScratch(projectRoot, token);
}
