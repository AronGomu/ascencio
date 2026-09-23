import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function scratchPath(root: string, token: string): string {
  if (!/^[a-f0-9-]{36}$/.test(token))
    throw new Error("CONTENT_BUILT_TOKEN is invalid");
  return path.join(root, ".tmp/t6-installed-built-subpath");
}

async function exists(file: string) {
  try {
    return await lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function checkParent(scratch: string): Promise<void> {
  const parent = await exists(path.dirname(scratch));
  if (parent !== null && !parent.isDirectory())
    throw new Error(`Refusing unsafe scratch parent: ${path.dirname(scratch)}`);
}

export async function createContentBuiltScratch(
  root: string,
  token: string,
): Promise<string> {
  const scratch = scratchPath(root, token);
  await mkdir(path.dirname(scratch), { recursive: true });
  await checkParent(scratch);
  try {
    // Match core scratch ownership: never adopt an existing directory.
    await mkdir(scratch);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(`Refusing to claim existing scratch path: ${scratch}`);
    throw error;
  }
  await writeFile(path.join(scratch, ".content-built-owner"), token, {
    flag: "wx",
  });
  return scratch;
}

export async function removeContentBuiltScratch(
  root: string,
  token: string,
): Promise<void> {
  const scratch = scratchPath(root, token);
  await checkParent(scratch);
  const directory = await exists(scratch);
  if (directory === null) return;
  const marker = path.join(scratch, ".content-built-owner");
  if (
    !directory.isDirectory() ||
    !(await exists(marker))?.isFile() ||
    (await readFile(marker, "utf8")) !== token
  )
    throw new Error(`Refusing to remove unowned scratch path: ${scratch}`);
  await rm(scratch, { recursive: true, force: false });
}
