import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

export interface AiBotPackage {
  manifestVersion: 1;
  id: string;
  name: string;
  version: string;
  botContractVersion: 1;
  ai: { language: "typescript"; source: string; entry: string };
  settings: string;
  resources: Record<string, string>;
  recommendedDecks: string[];
}

/** Package paths are relative, including generated entries that do not exist yet. */
export function packagePath(folder: string, value: unknown): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\\") ||
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("AI package path must stay within its folder");
  return path.join(folder, value);
}

export async function readAiBotPackage(folder: string) {
  folder = await realpath(folder);
  const manifest = JSON.parse(
    await readFile(path.join(folder, "bot.json"), "utf8"),
  ) as AiBotPackage;
  if (
    manifest.manifestVersion !== 1 ||
    manifest.botContractVersion !== 1 ||
    typeof manifest.id !== "string" ||
    !/^[a-z0-9][a-z0-9._-]*$/.test(manifest.id) ||
    typeof manifest.name !== "string" ||
    !manifest.name ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
    manifest.ai?.language !== "typescript" ||
    typeof manifest.ai.source !== "string" ||
    typeof manifest.ai.entry !== "string" ||
    !manifest.ai.source.endsWith(".ts") ||
    !manifest.ai.entry.endsWith(".mjs") ||
    !Array.isArray(manifest.recommendedDecks) ||
    !manifest.resources ||
    typeof manifest.resources !== "object" ||
    Array.isArray(manifest.resources)
  )
    throw new Error("Invalid TypeScript AI package manifest");
  packagePath(folder, manifest.ai.entry);
  for (const file of [
    manifest.ai.source,
    manifest.settings,
    ...manifest.recommendedDecks,
    ...Object.values(manifest.resources),
  ]) {
    const resolved = await realpath(packagePath(folder, file));
    if (!resolved.startsWith(folder + path.sep))
      throw new Error("AI package resource escapes its folder");
  }
  const settings: unknown = JSON.parse(
    await readFile(packagePath(folder, manifest.settings), "utf8"),
  );
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings) ||
    Object.values(settings).some(
      (value) => !["string", "number", "boolean"].includes(typeof value),
    )
  )
    throw new Error("AI settings must contain scalar values");
  return {
    folder,
    manifest,
    settings: settings as Record<string, string | number | boolean>,
  };
}
