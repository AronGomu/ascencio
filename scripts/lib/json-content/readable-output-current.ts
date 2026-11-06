import { lstat, readFile, rename } from "node:fs/promises";
import path from "node:path";
import type { PackageManifest } from "../../../src/storage/contracts/package.ts";
import { canonicalJson } from "./compile-snapshot.ts";
import { withWindowsRenameRetry } from "../windows-rename-retry.ts";

/** Preserve stale generated source for inspection; never reuse it for a new release. */
export async function readableOutputCurrent(
  output: string,
  manifest: PackageManifest,
): Promise<boolean> {
  try {
    const info = await lstat(output);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error(`Invalid readable output: ${output}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  let source;
  try {
    const file = await lstat(path.join(output, "pack.json"));
    if (!file.isFile() || file.isSymbolicLink())
      throw new Error("Invalid readable source file");
    source = JSON.parse(await readFile(path.join(output, "pack.json"), "utf8"));
  } catch (cause) {
    throw new Error(
      `Incomplete conversion at ${output}. Move that directory aside before retrying.`,
      { cause },
    );
  }
  if (
    source.format !== "ascencio-readable-pack" ||
    source.manifest?.packageId !== manifest.packageId
  )
    throw new Error(`Invalid readable source identity: ${output}`);
  if (canonicalJson(source.manifest) === canonicalJson(manifest)) return true;
  const previous = `${output}-${crypto.randomUUID()}.previous`;
  await withWindowsRenameRetry(() => rename(output, previous));
  console.log(`Preserved stale readable source at ${previous}`);
  return false;
}
