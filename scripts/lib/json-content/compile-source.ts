import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  CriticalSnapshot,
  CriticalResource,
} from "../../../src/storage/contracts/critical-snapshot.ts";
import { validAssetPath } from "../../../src/storage/schema/package-database.ts";
import { readableCard } from "../../../src/storage/snapshot/readable-card.ts";
import { canonicalJson, compileSnapshot } from "./compile-snapshot.ts";
import type { SourceManifest } from "./source-manifest.ts";

export async function compileSource(root: string, output: string) {
  const base = await realpath(root);
  let total = 0;
  async function bytes(file: string): Promise<Buffer> {
    if (!validAssetPath(file)) throw new Error(`SOURCE_PATH: ${file}`);
    const target = path.join(base, file);
    const resolved = await realpath(target);
    if (!resolved.startsWith(`${base}${path.sep}`) || resolved !== target)
      throw new Error(`SOURCE_CONTAINMENT: ${file}`);
    const info = await lstat(resolved);
    if (
      !info.isFile() ||
      info.size > 16 * 1024 * 1024 ||
      (total += info.size) > 256 * 1024 * 1024
    )
      throw new Error(`SOURCE_SIZE: ${file}`);
    return readFile(resolved);
  }
  async function json(file: string): Promise<unknown> {
    try {
      return JSON.parse((await bytes(file)).toString("utf8")) as unknown;
    } catch (cause) {
      throw new Error(`SOURCE_JSON: ${file}`, { cause });
    }
  }
  const source = (await json("pack.json")) as SourceManifest;
  if (
    source.format !== "ascencio-readable-pack" ||
    source.schemaVersion !== 1 ||
    Object.keys(source).sort().join() !==
      [
        "format",
        "schemaVersion",
        "manifest",
        "config",
        "cards",
        "scripts",
        "sets",
        "decks",
        "opponents",
        "rules",
        "stories",
        "media",
        "engine",
      ]
        .sort()
        .join()
  )
    throw new Error("SOURCE_SCHEMA: pack.json");
  for (const key of [
    "cards",
    "scripts",
    "sets",
    "decks",
    "opponents",
    "stories",
    "media",
    "engine",
  ] as const)
    if (!Array.isArray(source[key]) || source[key].length > 100_000)
      throw new Error(`SOURCE_SIZE: /${key}`);
  const map: Record<string, { file: string; pointer: string }> = {};
  const cards = [];
  for (const [i, file] of source.cards.entries()) {
    const card = readableCard(await json(file));
    if (card.id !== `official:${card.definition.code}`)
      throw new Error(`CARD_SOURCE: ${file}`);
    cards.push({ definition: card.definition, texts: card.texts });
    map[`/cards/${i}`] = { file, pointer: "/engine" };
  }
  const scripts = [];
  for (const [i, script] of source.scripts.entries()) {
    scripts.push({
      name: script.name,
      source: (await bytes(script.path)).toString("utf8"),
    });
    map[`/scripts/${i}`] = { file: script.path, pointer: "" };
  }
  async function entities(
    files: readonly string[],
    key: string,
  ): Promise<unknown[]> {
    const result = [];
    for (const [i, file] of files.entries()) {
      result.push(await json(file));
      map[`/${key}/${i}`] = { file, pointer: "" };
    }
    return result;
  }
  const rules = (await json(source.rules)) as {
    schemaVersion: number;
    quantityByCode: unknown;
  };
  if (
    rules.schemaVersion !== 1 ||
    Object.keys(rules).sort().join() !== "quantityByCode,schemaVersion"
  )
    throw new Error(`RULES_SCHEMA: ${source.rules}`);
  const value = {
    schemaVersion: 1,
    compilerVersion: 1,
    manifest: source.manifest,
    config: await json(source.config),
    cards,
    scripts,
    sets: await entities(source.sets, "sets"),
    decks: await entities(source.decks, "decks"),
    opponents: await entities(source.opponents, "opponents"),
    limits: rules.quantityByCode,
    stories: await entities(source.stories, "stories"),
    media: source.media,
  };
  const compiled = compileSnapshot(value);
  // Maps follow the compiler's canonical entity ordering, rather than source listing order.
  for (const key of [
    "cards",
    "scripts",
    "sets",
    "decks",
    "opponents",
    "stories",
  ] as const) {
    const original = value[key];
    const ordered = compiled.snapshot[key];
    const locations = original.map((_, i) => map[`/${key}/${i}`]!);
    const identity = (entity: unknown) =>
      key === "cards"
        ? (entity as CriticalSnapshot["cards"][number]).definition.code
        : key === "scripts"
          ? (entity as CriticalSnapshot["scripts"][number]).name
          : key === "stories"
            ? (entity as CriticalSnapshot["stories"][number]).contentId
            : (entity as { id: string }).id;
    const byIdentity = new Map(
      original.map((entity, index) => [identity(entity), locations[index]!]),
    );
    for (const [i, entity] of ordered.entries())
      map[`/${key}/${i}`] = byIdentity.get(identity(entity))!;
  }
  map["/config"] = { file: source.config, pointer: "" };
  map["/limits"] = { file: source.rules, pointer: "/quantityByCode" };
  const engine: CriticalResource[] = [];
  for (const entry of source.engine) {
    const content = await bytes(entry.file);
    engine.push({
      path: entry.path,
      bytes: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "critical.json"), compiled.source);
  await writeFile(
    path.join(output, "source-map.json"),
    canonicalJson({ schemaVersion: 1, sources: map }),
  );
  return { ...compiled, engine };
}
