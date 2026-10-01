import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { exportPackages } from "../../../scripts/lib/sqlite-content/index.ts";

it.each(["exact", "minimum"] as const)(
  "stages default native content with %s dependencies from the exporter's layout",
  async (requirement) => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ascencio-native-defaults-"),
    );
    try {
      await cp(
        "tests/fixtures/sqlite",
        path.join(root, "tests/fixtures/sqlite"),
        { recursive: true },
      );
      await cp(
        "scripts/native-content-release.ts",
        path.join(root, "scripts/native-content-release.ts"),
        { recursive: true },
      );
      await symlink(
        path.resolve("scripts/lib"),
        path.join(root, "scripts/lib"),
        "dir",
      );
      await symlink(path.resolve("src"), path.join(root, "src"), "dir");
      const spec = JSON.parse(
        await readFile("tests/fixtures/sqlite/packages.json", "utf8"),
      );
      if (requirement === "minimum") {
        spec.packages.find(
          (entry: { manifest: { packageId: string } }) =>
            entry.manifest.packageId === "card-library",
        ).manifest.version = "2.0.0";
        spec.packages.find(
          (entry: { manifest: { packageId: string } }) =>
            entry.manifest.packageId === "freeplay",
        ).manifest.dependencies[0].requirement = "minimum";
      }
      const recipe = JSON.stringify(spec);
      const result = await exportPackages(root, spec);
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") throw new Error(result.error.code);
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(path.join(root, "content"));
      await writeFile(path.join(root, "content/packages.json"), recipe);
      const run = promisify(execFile);
      const script = path.join(root, "scripts/native-content-release.ts");
      await run(process.execPath, [script, "manifest"]);
      await run(process.execPath, [script, "prepare"]);
      await run(process.execPath, [script, "verify-staged"]);
      const stage = path.join(root, "src-tauri/resources/game-content");
      expect((await readdir(stage)).sort()).toEqual([
        "card-library.sqlite",
        "chapter-01.sqlite",
        "duel-core.sqlite",
        "freeplay.sqlite",
        "release.json",
      ]);
      const manifest = JSON.parse(
        await readFile(path.join(stage, "release.json"), "utf8"),
      );
      expect(
        manifest.packages.map(
          (entry: { packageId: string }) => entry.packageId,
        ),
      ).toEqual(["duel-core", "card-library", "freeplay", "chapter-01"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
