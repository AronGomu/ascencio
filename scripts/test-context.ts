import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gatherBranchContext } from "./lib/branch-test-context.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  const args = process.argv.slice(2);
  if (
    args.length !== 0 &&
    (args.length !== 2 ||
      args[0] !== "--base" ||
      !args[1] ||
      args[1].startsWith("--"))
  )
    throw new Error("Usage: npm run test:context -- [--base <ref>]");
  const context = gatherBranchContext(root, args[1] ?? null);
  const output = path.join(root, "generated/tests/branch-context.json");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(context, null, 2) + "\n");
  console.log(
    `Agent context: ${output}\nBranch: ${context.branch}; base: ${context.base}\n${context.commits.length} branch commits, ${context.changedFiles.length} changed files, ${context.selectedTests.length} suggested tests. No tests executed.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
