import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { digest, identity } from "./session-fixtures.ts";

/** Archive-shaped trees only: no symlinks, devices or implicit build exclusions. */
export async function readTree(root: string): Promise<Record<string, Buffer>> {
  const files: Record<string, Buffer> = {};
  async function visit(dir: string) {
    for (const entry of await readdir(path.join(root, dir), {
      withFileTypes: true,
    })) {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile())
        files[file] = await readFile(path.join(root, file));
      else throw new Error(`Archive requires regular files: ${file}`);
    }
  }
  await visit("");
  return files;
}
export function hashes(files: Record<string, Uint8Array>) {
  return Object.fromEntries(
    Object.keys(files)
      .sort()
      .map((file) => [file, digest(files[file]!)]),
  );
}
export async function writeTree(
  root: string,
  files: Record<string, Uint8Array>,
) {
  for (const [file, bytes] of Object.entries(files)) {
    if (
      path.isAbsolute(file) ||
      file.split(/[\\/]/).some((part) => part === ".." || !part)
    )
      throw new Error(`Unsafe archive path: ${file}`);
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), bytes, { flag: "wx" });
  }
}
export function treeIdentity(files: Record<string, Uint8Array>) {
  return identity(hashes(files));
}
