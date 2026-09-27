import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPackageFile } from "./lib/sqlite-content/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.exitCode = await run(process.argv.slice(2));
async function run(args: readonly string[]): Promise<number> {
  try {
    if (args.length === 1 && args[0] === "--help")
      return output(
        {
          kind: "ok",
          value: {
            usage: "npm run content:verify -- --file <file>",
            scope:
              "Single-file schema, rows, SQLite integrity, script and asset SHA-256; not cross-package stack validity. Full-recipe references are checked by content:export.",
          },
        },
        0,
      );
    if (args.length !== 2 || args[0] !== "--file" || !args[1])
      return output(
        { kind: "failed", error: { code: "PACKAGE_INVALID", path: "--file" } },
        2,
      );
    console.error(`verifying package ${args[1]}`);
    const result = await verifyPackageFile(root, args[1]);
    return output(result, result.kind === "ok" ? 0 : 2);
  } catch {
    return output(
      { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } },
      1,
    );
  }
}
function output(value: unknown, code: number): number {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  return code;
}
