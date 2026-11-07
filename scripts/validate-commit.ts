import { validateCommit } from "./lib/commit-validation.ts";

try {
  if (Number(process.versions.node.split(".")[0]) < 26)
    throw new Error("Use Node.js 26 or newer for local commit validation.");
  const args = process.argv.slice(2);
  if (
    args.length &&
    (args[0] !== "--tests" ||
      args.length < 2 ||
      args.slice(1).some((arg) => arg.startsWith("--")))
  ) {
    throw new Error(
      "Usage: npm run commit:validate -- [--tests <exact-test-files>]",
    );
  }
  validateCommit(process.cwd(), args.slice(1));
} catch (error) {
  console.error(
    `[pre-commit] Commit blocked: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
