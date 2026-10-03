import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { ContentDiagnostic } from "../src/modules/commerce/composition.ts";
import { exportPackages } from "./lib/sqlite-content/index.ts";
import type { PackageBuildSpec } from "../src/storage/contracts/package-build.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.exitCode = await run(process.argv.slice(2));

async function run(args: readonly string[]): Promise<number> {
  try {
    if (args.length === 1 && args[0] === "--help")
      return output(
        {
          kind: "ok",
          value: {
            usage: "npm run legacy:content:export-sqlite -- --spec <file>",
          },
        },
        0,
      );
    if (args.length !== 2 || args[0] !== "--spec" || !args[1])
      return output(
        { kind: "failed", error: { code: "PACKAGE_INVALID", path: "--spec" } },
        2,
      );
    const specPath = safe(args[1]);
    const info = await import("node:fs/promises").then(({ stat }) =>
      stat(specPath),
    );
    if (!info.isFile() || info.size > 1024 * 1024)
      return output(
        { kind: "failed", error: { code: "PACKAGE_INVALID", path: args[1] } },
        2,
      );
    const spec = JSON.parse(
      await readFile(specPath, "utf8"),
    ) as PackageBuildSpec;
    console.error(`exporting packages from ${args[1]}`);
    const result = await exportPackages(root, spec);
    return output(result, result.kind === "ok" ? 0 : 2);
  } catch (error) {
    if (error instanceof ContentDiagnostic)
      return output(
        {
          kind: "failed",
          error: {
            code: error.code,
            phase: "compile",
            source: error.source,
            path: error.source,
            pointer: error.pointer,
            related: error.related,
          },
        },
        2,
      );
    return output(
      { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } },
      1,
    );
  }
}
function safe(relative: string): string {
  if (
    path.isAbsolute(relative) ||
    relative.includes("\\") ||
    relative
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  )
    throw new Error("unsafe path");
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${root}${path.sep}`))
    throw new Error("unsafe path");
  return resolved;
}
function output(value: unknown, code: number): number {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  return code;
}
