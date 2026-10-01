import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { orderPackages } from "../src/storage/schema/package-manifest.ts";
import { verifyPackageFile } from "./lib/sqlite-content/index.ts";
import type { PackageBuildSpec } from "../src/storage/contracts/package-build.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipePath = path.join(root, "content/packages.json");
const releasePath = path.join(root, "content/native-release.json");
const stageRoot = path.join(root, "src-tauri/resources");
const marker = ".ascencio-native-stage";
const markerText = "ascencio-native-stage-v1\n";

interface ReleasePackage {
  readonly packageId: string;
  readonly version: string;
  readonly bytes: number;
  readonly sha256: string;
}
interface ReleaseManifest {
  readonly schemaVersion: 1;
  readonly packages: readonly ReleasePackage[];
}

const command = process.argv[2];
if (!["manifest", "prepare", "verify-staged"].includes(command ?? "")) {
  console.error(
    "Usage: node scripts/native-content-release.ts manifest|prepare|verify-staged",
  );
  process.exitCode = 2;
} else {
  try {
    const expected = await verifiedLocalRelease();
    if (command === "manifest") {
      await writeFile(releasePath, `${JSON.stringify(expected, null, 2)}\n`);
      console.log(`Wrote ${path.relative(root, releasePath)}`);
    } else {
      const pinned = parseRelease(await readFile(releasePath, "utf8"));
      if (JSON.stringify(pinned) !== JSON.stringify(expected))
        throw new Error(
          "Local packages differ from tracked content/native-release.json",
        );
      if (command === "prepare") await prepare(pinned);
      else await verifyStaged(pinned);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function verifiedLocalRelease(): Promise<ReleaseManifest> {
  const recipe = JSON.parse(
    await readFile(recipePath, "utf8"),
  ) as PackageBuildSpec;
  if (recipe.schemaVersion !== 1 || !Array.isArray(recipe.packages))
    throw new Error("Invalid package recipe");
  const ids = new Set<string>();
  const packages: ReleasePackage[] = [];
  for (const entry of recipe.packages) {
    const { packageId, version } = entry.manifest;
    if (
      !/^(duel-core|card-library|freeplay|chapter-(?:0[1-9]|[1-9][0-9]+)|card-pack-[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(
        packageId,
      ) ||
      !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version) ||
      ids.has(packageId)
    )
      throw new Error(`Invalid or duplicate recipe package ${packageId}`);
    ids.add(packageId);
    const relative = `generated/content-packages/${packageId}-${version}.sqlite`;
    const result = await verifyPackageFile(root, relative);
    if (
      result.kind === "failed" ||
      result.value.packageId !== packageId ||
      packageVersion(path.join(root, relative)) !== version
    )
      throw new Error(`Missing or invalid package ${relative}`);
    packages.push({
      packageId,
      version,
      bytes: result.value.bytes,
      sha256: result.value.sha256,
    });
  }
  for (const required of [
    "duel-core",
    "card-library",
    "freeplay",
    "chapter-01",
  ])
    if (!ids.has(required)) throw new Error(`Native release lacks ${required}`);
  const graph = orderPackages(
    recipe.packages.map((entry) => entry.manifest),
    [],
  );
  if (graph.kind === "failed")
    throw new Error(`Invalid native module dependencies: ${graph.error.code}`);
  return { schemaVersion: 1, packages };
}

function packageVersion(file: string): string {
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    const row = database
      .prepare("SELECT version FROM package_manifest")
      .get() as { version?: unknown } | undefined;
    return typeof row?.version === "string" ? row.version : "";
  } finally {
    database.close();
  }
}

function parseRelease(source: string): ReleaseManifest {
  const value = JSON.parse(source) as ReleaseManifest;
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.packages) ||
    value.packages.some(
      (item) =>
        typeof item.packageId !== "string" ||
        typeof item.version !== "string" ||
        !Number.isSafeInteger(item.bytes) ||
        item.bytes < 512 ||
        !/^[a-f0-9]{64}$/.test(item.sha256),
    )
  )
    throw new Error("Invalid native release manifest");
  return value;
}

async function prepare(release: ReleaseManifest): Promise<void> {
  await mkdir(stageRoot, { recursive: true });
  const contentRoot = path.join(stageRoot, "game-content");
  const temporary = path.join(stageRoot, `game-content-${process.pid}.partial`);
  await rm(temporary, { recursive: true, force: true });
  try {
    await mkdir(temporary);
    for (const item of release.packages) {
      const from = path.join(
        root,
        "generated/content-packages",
        `${item.packageId}-${item.version}.sqlite`,
      );
      const to = path.join(temporary, `${item.packageId}.sqlite`);
      await copyFile(from, to);
      await verifyFile(to, item);
    }
    await writeFile(
      path.join(temporary, "release.json"),
      `${JSON.stringify(release, null, 2)}\n`,
    );
    await writeFile(path.join(stageRoot, marker), markerText);
    await rm(contentRoot, { recursive: true, force: true });
    await rename(temporary, contentRoot);
    console.log(
      `Staged ${release.packages.length} verified packages in ${contentRoot}`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function verifyStaged(release: ReleaseManifest): Promise<void> {
  const contentRoot = path.join(stageRoot, "game-content");
  if ((await readFile(path.join(stageRoot, marker), "utf8")) !== markerText)
    throw new Error("Native staging marker is invalid");
  const actual = (await readdir(contentRoot)).sort();
  const expected = [
    ...release.packages.map((item) => `${item.packageId}.sqlite`),
    "release.json",
  ].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Staged content file set differs from release manifest");
  const stagedManifest = parseRelease(
    await readFile(path.join(contentRoot, "release.json"), "utf8"),
  );
  if (JSON.stringify(stagedManifest) !== JSON.stringify(release))
    throw new Error("Staged release manifest differs from tracked manifest");
  for (const item of release.packages)
    await verifyFile(path.join(contentRoot, `${item.packageId}.sqlite`), item);
  console.log(`Verified ${release.packages.length} staged packages`);
}

async function verifyFile(file: string, item: ReleasePackage): Promise<void> {
  const info = await lstat(file);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size !== item.bytes ||
    (await digest(file)) !== item.sha256
  )
    throw new Error(`Staged package identity mismatch: ${item.packageId}`);
}

async function digest(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
