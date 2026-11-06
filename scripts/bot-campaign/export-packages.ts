/** Export accepted BotModule factories without checkout-local import paths. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
const root = resolve(process.argv[2] ?? "");
const state = JSON.parse(await readFile(join(root, "state.json"), "utf8")) as {
  runtime: string;
  epoch: number;
  decks: Record<string, { incumbent: string }>;
};
const directory = join(root, "final");
await mkdir(directory, { recursive: true });
const exported: Record<string, unknown> = {};
for (const [deck, value] of Object.entries(state.decks)) {
  const id = value.incumbent;
  if (!/^[a-f0-9]{64}$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(deck))
    throw new Error("Invalid archived identity");
  const module = join(directory, `${deck}.mjs`);
  await build({
    entryPoints: [join(root, "versions", id, "bot.mjs")],
    bundle: true,
    platform: "browser",
    format: "esm",
    outfile: module,
  });
  const pkg = JSON.parse(
    await readFile(join(root, "versions", id, "package.json"), "utf8"),
  ) as { config: unknown };
  const sha256 = createHash("sha256")
    .update(await readFile(module))
    .digest("hex");
  exported[deck] = {
    version: id,
    module: `${deck}.mjs`,
    config: pkg.config,
    sha256,
    runtime: state.runtime,
    epoch: state.epoch,
  };
}
await writeFile(
  join(directory, "packages.json"),
  JSON.stringify(exported, null, 2),
);
