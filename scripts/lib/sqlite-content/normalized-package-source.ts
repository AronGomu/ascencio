import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { PackageId } from "../../../src/storage/contracts/package.ts";
import type {
  RuntimeCardRecord,
  RuntimeCardText,
} from "./normalized-card-record.ts";
import { exact, reference } from "../../../src/modules/commerce/validation.ts";
import { assertNoSymlinkParents } from "./asset-restructure.ts";

export class NormalizedSourceFailure extends Error {
  readonly packageId: PackageId;
  readonly sourcePath: string;
  constructor(packageId: PackageId, sourcePath: string) {
    super("PACKAGE_SOURCE_INCOMPLETE");
    this.packageId = packageId;
    this.sourcePath = sourcePath;
  }
}

/** Read package-owned inputs only; malformed input is not an optional absence. */
export async function normalizedJson(
  root: string,
  relative: string,
  packageId: PackageId,
): Promise<unknown> {
  if (
    relative
      .split("/")
      .some(
        (part) => !part || part === "." || part === ".." || part.includes("\\"),
      )
  )
    throw new NormalizedSourceFailure(packageId, relative);
  await assertNoSymlinkParents(root, relative);
  try {
    return JSON.parse(
      await readFile(path.join(root, relative), "utf8"),
    ) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError || missing(error))
      throw new NormalizedSourceFailure(packageId, relative);
    throw error;
  }
}

export async function hasNormalizedCatalog(root: string): Promise<boolean> {
  try {
    return (await lstat(path.join(root, "data/catalog"))).isDirectory();
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
}

export async function loadNormalizedCatalog(
  root: string,
  locales: readonly string[],
) {
  if (!Array.isArray(locales) || locales.length === 0)
    throw new NormalizedSourceFailure("card-library", "config.json");
  const read = (relative: string) =>
    normalizedJson(root, relative, "card-library");
  const records: RuntimeCardRecord[] = [];
  for (const file of await shards(root, "data/catalog/cards")) {
    const rows = await read(file);
    if (!Array.isArray(rows))
      throw new NormalizedSourceFailure("card-library", file);
    records.push(...(rows as RuntimeCardRecord[]));
  }
  const cards = records.map((card) => ({
    code: card.code,
    alias: card.alias,
    setcodes: card.setcodes,
    type: card.type,
    level: card.level,
    attribute: card.attribute,
    race: card.race,
    attack: card.attack,
    defense: card.defense,
    lscale: card.lscale,
    rscale: card.rscale,
    linkMarker: card.linkMarker,
    scope: card.ot,
  }));
  const texts = [];
  for (const locale of locales) {
    if (!/^[a-z]{2}(?:-[A-Za-z0-9]+)*$/.test(locale))
      throw new NormalizedSourceFailure("card-library", "config.json");
    for (const file of await shards(root, `data/catalog/texts/${locale}`)) {
      const rows = await read(file);
      if (!Array.isArray(rows))
        throw new NormalizedSourceFailure("card-library", file);
      for (const { code, ...text } of rows as RuntimeCardText[])
        texts.push({ ...text, cardCode: code, locale });
    }
  }
  const scripts = [];
  const names = new Set<string>();
  const cardNames = new Set<string>();
  for (const file of [
    ...(await shards(root, "data/scripts/cards")),
    "data/scripts/globals.json",
  ]) {
    const values = await read(file);
    if (!values || typeof values !== "object" || Array.isArray(values))
      throw new NormalizedSourceFailure("card-library", file);
    for (const [name, source] of Object.entries(values)) {
      if (
        !/^[A-Za-z0-9_-]+\.lua$/.test(name) ||
        typeof source !== "string" ||
        names.has(name)
      )
        throw new NormalizedSourceFailure("card-library", file);
      names.add(name);
      if (file !== "data/scripts/globals.json") cardNames.add(name);
      scripts.push({
        name,
        source,
        sha256: createHash("sha256").update(source, "utf8").digest("hex"),
      });
    }
  }
  const index = (await read("data/scripts/index.json")) as {
    official?: unknown;
    preRelease?: unknown;
    globals?: unknown;
  };
  if (
    !Array.isArray(index?.official) ||
    !Array.isArray(index.preRelease) ||
    !Array.isArray(index.globals)
  )
    throw new NormalizedSourceFailure(
      "card-library",
      "data/scripts/index.json",
    );
  const indexedCards = [...index.official, ...index.preRelease];
  const indexedNames = [...indexedCards, ...index.globals];
  if (
    indexedCards.length !== cardNames.size ||
    indexedCards.some((name) => !cardNames.has(name)) ||
    indexedNames.length !== names.size ||
    new Set(indexedNames).size !== names.size ||
    indexedNames.some((name) => !names.has(name))
  )
    throw new NormalizedSourceFailure(
      "card-library",
      "data/scripts/index.json",
    );
  return {
    cards,
    texts,
    scripts: scripts.sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    ),
  };
}

async function shards(root: string, directory: string): Promise<string[]> {
  await assertNoSymlinkParents(root, directory);
  let names: string[];
  try {
    names = await readdir(path.join(root, directory));
  } catch (error) {
    if (missing(error))
      throw new NormalizedSourceFailure("card-library", directory);
    throw error;
  }
  if (!names.length || names.some((name) => !/^[a-f0-9]{2}\.json$/.test(name)))
    throw new NormalizedSourceFailure("card-library", directory);
  return names.sort().map((name) => `${directory}/${name}`);
}

export interface NormalizedMediaSource {
  readonly path: string;
  readonly source: string;
  readonly mime: string;
  readonly optional: boolean;
}
const mediaMime: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function normalizedMedia(
  root: string,
  packageId: PackageId,
  codes?: readonly number[],
): Promise<NormalizedMediaSource[]> {
  const assets: NormalizedMediaSource[] = [];
  if (codes) {
    for (const code of codes) {
      for (const variant of ["full", "cropped"])
        assets.push({
          path: `cards/${variant}/${code}.jpg`,
          source: `images/${variant}/${code}.jpg`,
          mime: "image/jpeg",
          optional: true,
        });
    }
    assets.push({
      path: "card-back.jpg",
      source: "images/card-back.jpg",
      mime: "image/jpeg",
      optional: true,
    });
  }
  const directory = codes ? "images/sets" : "media";
  async function walk(relative: string): Promise<void> {
    await assertNoSymlinkParents(root, relative);
    let entries;
    try {
      entries = await readdir(path.join(root, relative), {
        withFileTypes: true,
      });
    } catch (error) {
      if (missing(error)) return;
      throw error;
    }
    for (const entry of entries) {
      const source = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(source);
        continue;
      }
      // Set acquisition lock is provenance, not image media.
      if (codes && relative === directory && entry.name === "manifest.json")
        continue;
      const mime = mediaMime[path.extname(entry.name)];
      if (!entry.isFile() || !mime)
        throw new NormalizedSourceFailure(packageId, source);
      assets.push({
        path: codes ? source.replace(/^images\//, "") : source,
        source,
        mime,
        optional: true,
      });
    }
  }
  await walk(directory);
  return assets;
}

export async function normalizedChapterLimits(
  root: string,
  codes: readonly number[],
  authored: readonly { cardCode: number; deckLimit: number }[],
) {
  const policy = await normalizedJson(
    root,
    "content/commerce/chapters/chapter-01.json",
    "chapter-01",
  );
  if (
    !exact(policy, ["shopId", "allowedCardCodes"]) ||
    !reference(policy.shopId) ||
    !Array.isArray(policy.allowedCardCodes) ||
    !policy.allowedCardCodes.every(
      (code) => Number.isSafeInteger(code) && codes.includes(code),
    ) ||
    new Set(policy.allowedCardCodes).size !== policy.allowedCardCodes.length
  )
    throw new NormalizedSourceFailure(
      "chapter-01",
      "content/commerce/chapters/chapter-01.json",
    );
  const global = new Set(codes);
  const included = new Set<number>(policy.allowedCardCodes);
  const limits = new Map<number, number>();
  for (const row of authored) {
    if (
      !global.has(row.cardCode) ||
      !included.has(row.cardCode) ||
      limits.has(row.cardCode) ||
      ![0, 1, 2].includes(row.deckLimit)
    )
      throw new NormalizedSourceFailure("chapter-01", "limits.json");
    limits.set(row.cardCode, row.deckLimit);
  }
  for (const code of codes) if (!included.has(code)) limits.set(code, 0);
  return [...limits]
    .sort(([a], [b]) => a - b)
    .map(([cardCode, deckLimit]) => ({ cardCode, deckLimit }));
}

function missing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
