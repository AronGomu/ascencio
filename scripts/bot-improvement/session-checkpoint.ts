import { readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { digest } from "./session-fixtures.ts";
import type { EvidenceReference } from "./session-control-contract.ts";

export const json = async (file: string) =>
  JSON.parse(await readFile(file, "utf8"));
export async function optionalJson(file: string) {
  try {
    return await json(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function save(file: string, data: unknown) {
  const stage = `${file}.staging-${randomUUID()}`;
  try {
    await writeFile(stage, `${JSON.stringify(data, null, 2)}\n`, {
      flag: "wx",
    });
    await rename(stage, file);
  } finally {
    await rm(stage, { force: true });
  }
}
export async function evidence(session: string, ref: EvidenceReference) {
  if (
    !ref ||
    !ref.path ||
    path.isAbsolute(ref.path) ||
    ref.path.split(/[\\/]/).includes("..")
  )
    throw new Error("Unsafe evidence path");
  if (digest(await readFile(path.join(session, ref.path))) !== ref.sha256)
    throw new Error(`Evidence mismatch: ${ref.path}`);
}
