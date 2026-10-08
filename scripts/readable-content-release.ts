import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rmdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSource } from "./lib/json-content/compile-source.ts";
import { canonicalJson } from "./lib/json-content/compile-snapshot.ts";
import {
  orderPackages,
  parsePackageManifest,
} from "../src/storage/schema/package-manifest.ts";
import type {
  CriticalRelease,
  CriticalResource,
} from "../src/storage/contracts/critical-snapshot.ts";
import type { SourceManifest } from "./lib/json-content/source-manifest.ts";
import { withWindowsRenameRetry } from "./lib/windows-rename-retry.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "generated/readable-content-v1");
const pinnedPath = path.join(root, "content/critical-release.json");
const stage = path.join(root, "src-tauri/resources/readable-content");
const recipe = JSON.parse(
  await readFile(path.join(root, "content/packages.json"), "utf8"),
) as { packages: { manifest: unknown }[] };
if (!Array.isArray(recipe.packages) || recipe.packages.length > 64)
  throw new Error("RELEASE_RECIPE");
const ids = recipe.packages.map((pack) => {
  const parsed = parsePackageManifest(pack.manifest);
  if (parsed.kind === "failed") throw new Error(parsed.error.code);
  return parsed.value.packageId;
});
if (new Set(ids).size !== ids.length) throw new Error("PACKAGE_DUPLICATE");
const command = process.argv[2];
if (!["manifest", "prepare", "verify-staged"].includes(command ?? "")) {
  console.error(
    "Usage: node scripts/readable-content-release.ts manifest|prepare|verify-staged",
  );
  process.exitCode = 2;
} else {
  try {
    if (command === "verify-staged") await verifyStaged();
    else {
      const packages: CriticalRelease["packages"][number][] = [];
      const engine: CriticalResource[] = [];
      const manifests = [];
      for (const id of ids) {
        console.log(`Compiling readable content: ${id}`);
        const directory = path.join(sourceRoot, id);
        const result = await compileSource(directory, directory);
        if (result.snapshot.manifest.packageId !== id)
          throw new Error(`RELEASE_IDENTITY: ${id}`);
        manifests.push(result.snapshot.manifest);
        packages.push({
          packageId: id,
          version: result.snapshot.manifest.version,
          path: `${id}/critical.json`,
          bytes: result.bytes,
          sha256: result.sha256,
        });
        for (const entry of result.engine)
          engine.push({ ...entry, path: `${id}/${entry.path}` });
      }
      const graph = orderPackages(manifests, []);
      if (graph.kind === "failed") throw new Error(graph.error.code);
      const release: CriticalRelease = {
        schemaVersion: 1,
        compilerVersion: 1,
        packages,
        engine,
      };
      await verifyEngine(sourceRoot, release);
      const source = `${canonicalJson(release)}\n`;
      if (command === "manifest") {
        await writeFile(pinnedPath, source);
        console.log("Pinned readable critical release");
      } else {
        if (source !== (await readFile(pinnedPath, "utf8")))
          throw new Error(
            "RELEASE_UNPINNED: run content:release:pin after reviewing source changes",
          );
        await mkdir(path.dirname(stage), { recursive: true });
        const temporary = `${stage}-${crypto.randomUUID()}.partial`;
        await mkdir(temporary);
        try {
          for (const id of ids)
            await cp(path.join(sourceRoot, id), path.join(temporary, id), {
              recursive: true,
              force: false,
              errorOnExist: true,
            });
          await writeFile(path.join(temporary, "release.json"), source);
          await writeFile(
            path.join(temporary, ".ascencio-readable-stage"),
            "ascencio-readable-stage-v1\n",
          );
          let existing = null;
          try {
            existing = await lstat(stage);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          if (existing === null) {
            await withWindowsRenameRetry(() => rename(temporary, stage));
          } else {
            if (!existing.isDirectory() || existing.isSymbolicLink())
              throw new Error("RELEASE_STAGE_OWNERSHIP");
            let marker = null;
            try {
              marker = await readFile(
                path.join(stage, ".ascencio-readable-stage"),
                "utf8",
              );
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                throw error;
            }
            if (marker === null && (await readdir(stage)).length === 0) {
              // tauri_build creates this empty directory. Windows rename cannot
              // replace it; rmdir fails safely if another writer adds a file.
              await rmdir(stage);
              await withWindowsRenameRetry(() => rename(temporary, stage));
            } else {
              // Only a nonempty stage carrying our exact marker may be replaced.
              if (marker !== "ascencio-readable-stage-v1\n")
                throw new Error("RELEASE_STAGE_OWNERSHIP");
              const previous = `${stage}-${crypto.randomUUID()}.previous`;
              await withWindowsRenameRetry(() => rename(stage, previous));
              try {
                await withWindowsRenameRetry(() => rename(temporary, stage));
              } catch (error) {
                await withWindowsRenameRetry(() => rename(previous, stage));
                throw error;
              }
              await rm(previous, { recursive: true });
            }
          }
          await verifyStaged();
        } finally {
          await rm(temporary, { recursive: true, force: true });
        }
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
async function verifyResource(directory: string, resource: CriticalResource) {
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(resource.path) ||
    resource.path.split("/").some((p) => p === ".." || !p)
  )
    throw new Error("RELEASE_PATH");
  const file = path.join(directory, resource.path);
  const metadata = await lstat(file);
  const bytes = await readFile(file);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    bytes.length !== resource.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== resource.sha256
  )
    throw new Error(`RELEASE_HASH: ${resource.path}`);
}
async function verifyEngine(directory: string, release: CriticalRelease) {
  const expected = ["ocgcore.sync.wasm", "vendor-manifest.json"];
  if (release.engine.length !== 2) throw new Error("RELEASE_ENGINE");
  for (const name of expected) {
    const resource = release.engine.find(
      (e) => e.path === `duel-core/engine/${name}`,
    );
    if (!resource) throw new Error(`RELEASE_ENGINE: ${name}`);
    await verifyResource(directory, resource);
    const frozen = await readFile(
      path.join(
        root,
        "vendor/ocgcore-wasm/0.1.2",
        ...(name.endsWith(".wasm") ? ["lib", name] : [name]),
      ),
    );
    if (createHash("sha256").update(frozen).digest("hex") !== resource.sha256)
      throw new Error(`RELEASE_FROZEN_ENGINE: ${name}`);
  }
}
async function verifyStaged() {
  const source = await readFile(pinnedPath, "utf8");
  if (source !== (await readFile(path.join(stage, "release.json"), "utf8")))
    throw new Error("RELEASE_STAGE_MANIFEST");
  const release = JSON.parse(source) as CriticalRelease;
  if (
    release.schemaVersion !== 1 ||
    release.compilerVersion !== 1 ||
    release.packages.length !== ids.length
  )
    throw new Error("RELEASE_SCHEMA");
  for (const resource of release.packages)
    await verifyResource(stage, resource);
  await verifyEngine(stage, release);
  for (const id of ids) {
    const manifest = JSON.parse(
      await readFile(path.join(stage, id, "pack.json"), "utf8"),
    ) as SourceManifest;
    if (manifest.manifest.packageId !== id)
      throw new Error("RELEASE_SOURCE_IDENTITY");
  }
  console.log(
    `Verified ${release.packages.length} readable snapshots and frozen engine; media excluded from critical signatures`,
  );
}
