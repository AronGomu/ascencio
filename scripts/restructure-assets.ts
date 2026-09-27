import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAssetRestructure,
  planAssetRestructure,
  writeAssetRestructurePlan,
  type AssetMovePlan,
} from "./lib/sqlite-content/asset-restructure.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.exitCode = await run(process.argv.slice(2));
async function run(args: readonly string[]): Promise<number> {
  try {
    if (args.length === 1 && args[0] === "--help")
      return output(
        {
          kind: "ok",
          value: {
            usage: "npm run assets:restructure -- --plan | --apply <plan>",
          },
        },
        0,
      );
    if (args.length === 1 && args[0] === "--plan") {
      console.error("inventorying package source roots");
      const result = await planAssetRestructure(root);
      if (result.kind === "ok")
        await writeAssetRestructurePlan(root, result.value);
      return output(result, result.kind === "ok" ? 0 : 2);
    }
    if (args.length === 2 && args[0] === "--apply" && args[1]) {
      console.error(`applying copy plan ${args[1]}`);
      const plan = JSON.parse(
        await readFile(safe(args[1]), "utf8"),
      ) as AssetMovePlan;
      const result = await applyAssetRestructure(root, plan);
      return output(result, result.kind === "ok" ? 0 : 2);
    }
    return output({ kind: "failed", error: { code: "PACKAGE_INVALID" } }, 2);
  } catch {
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
  const result = path.resolve(root, relative);
  if (!result.startsWith(`${root}${path.sep}`)) throw new Error("unsafe path");
  return result;
}
function output(value: unknown, code: number): number {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  return code;
}
