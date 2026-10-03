import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateModManifest } from "../src/storage/mods/compose-mods.ts";

const [directory, output] = process.argv.slice(2);
try {
  if (!directory || !output)
    throw new Error(
      "Usage: node scripts/package-mod.ts <mod-directory> <new-bundle.json>",
    );
  const root = await realpath(directory);
  const manifest = validateModManifest(
    JSON.parse(await readFile(path.join(root, "mod.json"), "utf8")),
  );
  const files: { path: string; bytes: number[] }[] = [];
  const entities = new Set(manifest.entities.map((entity) => entity.path));
  const declared = [...entities, ...manifest.media.map((media) => media.path)];
  if (new Set(declared).size !== declared.length || declared.length > 10000)
    throw new Error("MOD_IMPORT_FILES");
  let total = 0;
  for (const relative of declared) {
    if (
      !relative ||
      relative
        .split("/")
        .some((part) => !part || part === "." || part === "..") ||
      /[\\:\0]/.test(relative) ||
      relative.split("/").length > 8
    )
      throw new Error(`MOD_IMPORT_PATH: ${relative}`);
    const file = path.join(root, relative);
    try {
      const resolved = await realpath(file);
      if (!resolved.startsWith(`${root}${path.sep}`))
        throw new Error(`MOD_IMPORT_PATH: ${relative}`);
      const stat = await lstat(file);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size > 64 * 1024 * 1024
      )
        throw new Error(`MOD_IMPORT_SIZE: ${relative}`);
      const bytes = await readFile(file);
      total += bytes.length;
      if (total > 64 * 1024 * 1024) throw new Error("MOD_IMPORT_SIZE");
      files.push({ path: relative, bytes: [...bytes] });
    } catch (error) {
      if (
        !entities.has(relative) &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      )
        continue;
      throw error;
    }
  }
  const source = JSON.stringify({ schemaVersion: 1, manifest, files });
  if (Buffer.byteLength(source) > 128 * 1024 * 1024)
    throw new Error("MOD_IMPORT_SIZE");
  await writeFile(output, source, { flag: "wx" });
  console.log(
    `Bundled ${manifest.id}; ${files.length} declared files, ${total} bytes. Startup performs Lua and composition validation.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
