import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyMigration,
  checkMigration,
} from "./lib/repository-migration/checker.ts";
import type { MigrationManifest } from "./lib/repository-migration/manifest.ts";

try {
  const [mode, manifestFile, flag, base, ...extra] = process.argv.slice(2);
  if (
    !manifestFile ||
    !["check", "apply"].includes(mode ?? "") ||
    extra.length ||
    (flag !== undefined && (flag !== "--base" || !base)) ||
    (mode === "apply" && flag)
  ) {
    throw new Error(
      "Usage: node scripts/check-repository-migration.ts <check|apply> <manifest.json> [--base <commit>]",
    );
  }
  const root = process.cwd();
  const manifest = JSON.parse(
    readFileSync(path.resolve(root, manifestFile), "utf8"),
  ) as MigrationManifest;
  if (mode === "apply") applyMigration(root, manifest);
  const errors = checkMigration(root, manifest, base ? { base } : {});
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Repository migration check passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
