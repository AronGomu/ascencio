import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeOutput } from "./output-storage.ts";
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
  const bytes = `${JSON.stringify(data, null, 2)}\n`;
  try {
    if ((await readFile(file, "utf8")) === bytes) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeOutput(file, bytes);
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
