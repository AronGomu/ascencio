import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageBuildSpec } from "../src/storage/contracts/package-build.ts";
import { exportPackages } from "./lib/sqlite-content/index.ts";
import { exportSqliteSource } from "./lib/json-content/export-sqlite-source.ts";
import { acquireRunLock } from "./lib/run-lock.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let releaseLock: (() => Promise<void>) | undefined;
function run(script: string, extra: string[] = []): void {
  console.log(`[setup] ${script} ${extra.join(" ")}`);
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts", script), ...extra],
    {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${script} failed (${result.status}); rerun setup to resume.`,
    );
}
async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
try {
  if (args.includes("--help")) {
    console.log(
      "Usage: npm run setup -- [--offline] [--sources-only]\nAcquires assets, creates readable content and verifies native staging. --sources-only prepares catalog/authoring for fixture checks without artwork or release staging. Does not open a window. Requires npm ci first.",
    );
  } else {
    if (args.some((arg) => !["--offline", "--sources-only"].includes(arg)))
      throw new Error("Unknown setup option; use --help");
    if (Number(process.versions.node.split(".")[0]) < 26)
      throw new Error("Install Node.js 26 or newer.");
    for (const executable of ["git", "cargo", "rustc"]) {
      const result = spawnSync(executable, ["--version"], {
        cwd: root,
        windowsHide: true,
      });
      if (result.error || result.status !== 0)
        throw new Error(
          `${executable} is unavailable. Follow docs/desktop-setup.md, then reopen your terminal.`,
        );
    }
    releaseLock = await acquireRunLock(
      path.join(root, "generated/.locks/desktop-setup"),
    );
    for (const id of ["card-library", "chapter-01"]) {
      await mkdir(path.join(root, "assets/content", id), { recursive: true });
      // Existing author edits are preserved. Compilation diagnoses divergent inputs.
      await cp(
        path.join(root, "content/bootstrap-inputs", id),
        path.join(root, "assets/content", id),
        {
          recursive: true,
          force: false,
        },
      );
    }
    run("verify-vendor.ts");
    if (args.includes("--sources-only")) {
      const offline = args.includes("--offline") ? ["--offline"] : [];
      run("sync-engine.ts", offline);
      run("verify-engine.ts");
      run("sync-assets.ts", offline);
      run("verify-assets.ts");
      console.log(
        "Source inputs verified. Artwork and native release staging still require full setup.",
      );
    } else {
      run("download-mvp-assets.ts", args);
      if (!args.includes("--offline")) {
        run("download-card-back.ts");
        run("download-set-images.ts");
      }
      run("verify-set-images.ts");
      const recipe = JSON.parse(
        await readFile(path.join(root, "content/packages.json"), "utf8"),
      ) as PackageBuildSpec;
      const readableRoot = path.join(root, "generated/readable-content-v1");
      await mkdir(readableRoot, { recursive: true });
      const missing = [];
      for (const entry of recipe.packages) {
        if (
          !(await exists(
            path.join(readableRoot, entry.manifest.packageId, "pack.json"),
          ))
        ) {
          const output = path.join(readableRoot, entry.manifest.packageId);
          if (await exists(output))
            throw new Error(
              `Incomplete conversion at ${output}. Move that directory aside before retrying.`,
            );
          missing.push(entry);
        }
      }
      if (missing.length) {
        console.log(
          "Generating historical conversion fixtures (several GB; allow time for filesystem verification).",
        );
        // Artwork exceeds ZIP32. Native startup consumes readable packs, not the legacy ZIP.
        const result = await exportPackages(root, recipe, { archive: false });
        if (result.kind !== "ok") throw new Error(JSON.stringify(result));
        for (const entry of missing) {
          const id = entry.manifest.packageId;
          const output = path.join(readableRoot, id);
          if (await exists(output))
            throw new Error(
              `Incomplete conversion at ${output}. Move that directory aside before retrying.`,
            );
          await exportSqliteSource(
            root,
            `generated/content-packages/${id}-${entry.manifest.version}.sqlite`,
            output,
          );
        }
      }
      run("readable-content-release.ts", ["prepare"]);
      run("readable-content-release.ts", ["verify-staged"]);
      console.log(
        "Setup verified. Build without opening a window: npm run build. Launch explicitly: npm start.",
      );
    }
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await releaseLock?.();
}
