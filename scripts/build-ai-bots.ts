import { readdir, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { packagePath, readAiBotPackage } from "./lib/ai-bots/package.ts";

export async function buildAiBot(folder: string) {
  const pack = await readAiBotPackage(folder);
  const output = packagePath(pack.folder, pack.manifest.ai.entry);
  await mkdir(path.dirname(output), { recursive: true });
  const parent = await realpath(path.dirname(output));
  if (!parent.startsWith(pack.folder + path.sep))
    throw new Error("AI output escapes its package");
  const result = await build({
    entryPoints: [packagePath(pack.folder, pack.manifest.ai.source)],
    outfile: output,
    bundle: true,
    metafile: true,
    format: "esm",
    platform: "browser",
    target: "es2023",
    logLevel: "silent",
  });
  return {
    id: pack.manifest.id,
    output,
    sources: Object.keys(result.metafile!.inputs).map((file) =>
      path.resolve(file),
    ),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const base = path.resolve("assets/ai-bots");
  const names = process.argv.slice(2);
  const folders = names.length
    ? names
    : (await readdir(base, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
  for (const name of folders) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
      throw new Error("Invalid bot folder name");
    const { id, output } = await buildAiBot(path.join(base, name));
    console.log(JSON.stringify({ id, output }));
  }
}
