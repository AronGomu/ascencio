import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeCoreScratch } from "./lib/core-source-scratch.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export default async function teardownCoreSourceOnly(): Promise<void> {
  const token = process.env.CORE_SOURCE_TOKEN;
  if (token === undefined) return;
  for (const id of ["root", "subpath"] as const)
    await removeCoreScratch(projectRoot, id, token);
}
