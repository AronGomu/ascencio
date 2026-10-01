import { randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  CARD_LIBRARY_SCHEMA_SQL,
  CHAPTER_SCHEMA_SQL,
  FREEPLAY_SCHEMA_SQL,
  PACKAGE_SCHEMA_SQL,
} from "../../../src/storage/schema/sql.ts";
import {
  orderPackages,
  parsePackageManifest,
} from "../../../src/storage/schema/package-manifest.ts";
import {
  ownedAssetPath,
  validAssetPath,
  validatePackageDatabase,
} from "../../../src/storage/schema/package-database.ts";
import type {
  PackageId,
  PackageManifest,
  StorageResult,
} from "../../../src/storage/contracts/package.ts";
import type {
  ExportReceipt,
  PackageBuildSpec,
} from "../../../src/storage/contracts/package-build.ts";
import type { SetRow } from "../../../src/storage/contracts/package-payloads.ts";
import { loadGlobalSets } from "./global-set-source.ts";
import { projectChapterStories } from "./chapter-story-source.ts";
import { projectNormalizedLibraryConfig } from "./normalized-library-config.ts";
import { assertNoSymlinkParents, hashFile } from "./asset-restructure.ts";
import {
  hasNormalizedCatalog,
  loadNormalizedCatalog,
  normalizedChapterLimits,
  normalizedMedia,
  NormalizedSourceFailure,
} from "./normalized-package-source.ts";
import { writePackageArchive } from "./package-archive.ts";

interface CardRow {
  readonly code: number;
  readonly alias: number;
  readonly setcodes: readonly number[];
  readonly type: number;
  readonly level: number;
  readonly attribute: number;
  readonly race: string;
  readonly attack: number;
  readonly defense: number;
  readonly lscale: number;
  readonly rscale: number;
  readonly linkMarker: number;
  readonly scope: number;
}
interface TextRow {
  readonly cardCode: number;
  readonly locale: string;
  readonly name: string;
  readonly description: string;
  readonly strings: readonly string[];
}
interface SetCardRow {
  readonly setId: string;
  readonly cardCode: number;
  readonly printingCode: string;
  readonly rarity: string;
  readonly sourceRarity: string;
  readonly sourceRarityCode: string;
}
interface DeckRow {
  readonly id: string;
  readonly name: string;
  readonly cards: {
    readonly main: readonly number[];
    readonly extra: readonly number[];
    readonly side: readonly number[];
  };
}
interface OpponentRow {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly deckId: string;
  readonly policyId: string;
}
interface LimitRow {
  readonly cardCode: number;
  readonly deckLimit: number;
}
interface AssetSource {
  readonly path: string;
  readonly source: string;
  readonly mime: string;
  readonly optional: boolean;
}
interface PackageSource {
  readonly manifest: PackageManifest;
  readonly root: string;
  readonly config: unknown;
  readonly cards: readonly CardRow[];
  readonly texts: readonly TextRow[];
  readonly scripts: readonly {
    readonly name: string;
    readonly source: string;
    readonly sha256: string;
  }[];
  readonly sets: readonly SetRow[];
  readonly setCards: readonly SetCardRow[];
  readonly decks: readonly DeckRow[];
  readonly opponents: readonly OpponentRow[];
  readonly limits: readonly LimitRow[];
  readonly stories: readonly unknown[];
  readonly assets: readonly AssetSource[];
  readonly missingOptionalMedia: readonly string[];
  readonly excludedSetMemberships: ExportReceipt["excludedSetMemberships"];
  readonly rarityWarnings: ExportReceipt["rarityWarnings"];
  readonly inventoryOnlyScripts: ExportReceipt["inventoryOnlyScripts"];
}
class ExpectedFailure extends Error {
  readonly result: StorageResult<never>;
  constructor(result: StorageResult<never>) {
    super(result.kind === "failed" ? result.error.code : "unexpected");
    this.result = result;
  }
}

export async function exportPackages(
  root: string,
  input: PackageBuildSpec,
): Promise<StorageResult<readonly ExportReceipt[]>> {
  try {
    if (
      !isRecord(input) ||
      input.schemaVersion !== 1 ||
      !Array.isArray(input.packages)
    )
      return failed("PACKAGE_INVALID");
    const entries: { manifest: PackageManifest; sourceRoot: string }[] = [];
    for (const entry of input.packages) {
      if (
        !isRecord(entry) ||
        Object.keys(entry).sort().join() !== "manifest,sourceRoot" ||
        typeof entry.sourceRoot !== "string"
      )
        return failed("PACKAGE_INVALID");
      const parsed = parsePackageManifest(entry.manifest);
      if (parsed.kind === "failed") return parsed;
      if (!validSourceRoot(entry.sourceRoot, parsed.value.packageId))
        return failed(
          "PACKAGE_INVALID",
          parsed.value.packageId,
          entry.sourceRoot,
        );
      entries.push({ manifest: parsed.value, sourceRoot: entry.sourceRoot });
    }
    const ordered = orderPackages(
      entries.map(({ manifest }) => manifest),
      [],
    );
    if (ordered.kind === "failed") return ordered;
    const byId = new Map(
      entries.map((entry) => [entry.manifest.packageId, entry]),
    );
    const sources: PackageSource[] = [];
    for (const manifest of ordered.value)
      sources.push(
        await loadSource(root, byId.get(manifest.packageId)!, sources),
      );
    validateCrossPackageSources(sources);
    const receipts: ExportReceipt[] = [];
    for (const source of sources)
      receipts.push(await writePackage(root, source));
    await writePackageArchive(root, receipts);
    return { kind: "ok", value: Object.freeze(receipts) };
  } catch (error) {
    if (error instanceof ExpectedFailure) return error.result;
    if (error instanceof NormalizedSourceFailure)
      return failed(
        "PACKAGE_SOURCE_INCOMPLETE",
        error.packageId,
        error.sourcePath,
      );
    throw error;
  }
}

async function loadSource(
  root: string,
  entry: { manifest: PackageManifest; sourceRoot: string },
  prior: readonly PackageSource[],
): Promise<PackageSource> {
  const sourceRoot = safe(root, entry.sourceRoot);
  await assertNoSymlinkParents(root, entry.sourceRoot);
  await requiredFile(sourceRoot, "config.json", entry.manifest.packageId);
  const config = await json(
    sourceRoot,
    "config.json",
    entry.manifest.packageId,
  );
  const normalized =
    entry.manifest.packageType === "card-library" &&
    (await hasNormalizedCatalog(sourceRoot));
  const catalog = normalized
    ? await loadNormalizedCatalog(
        sourceRoot,
        (config as { locales: string[] }).locales,
      )
    : null;
  const projectedConfig = catalog
    ? projectNormalizedLibraryConfig(config, catalog)
    : null;
  const derivedAssets = catalog
    ? await normalizedMedia(
        sourceRoot,
        entry.manifest.packageId,
        catalog.cards.map(({ code }) => code),
      )
    : entry.sourceRoot === "assets/content/chapter-01"
      ? await normalizedMedia(sourceRoot, entry.manifest.packageId)
      : [];
  const globalSets = catalog
    ? await loadGlobalSets(
        sourceRoot,
        catalog.cards.map(({ code }) => code),
        derivedAssets,
      )
    : null;
  if (globalSets) {
    const paths = new Set(derivedAssets.map((asset) => asset.path));
    for (const asset of globalSets.assets)
      if (!paths.has(asset.path)) derivedAssets.push(asset);
  }
  const assets = catalog
    ? derivedAssets
    : await optionalJson<AssetSource[]>(
        sourceRoot,
        "assets.json",
        derivedAssets,
        entry.manifest.packageId,
      );
  if (!Array.isArray(assets))
    incomplete(entry.manifest.packageId, "assets.json");
  for (const asset of assets)
    if (!validAssetSource(asset) || !ownedAssetPath(entry.manifest, asset.path))
      incomplete(entry.manifest.packageId, "assets.json");
  unique(
    assets.map(({ path }) => path.normalize("NFC").toLocaleLowerCase("en-US")),
    entry.manifest.packageId,
    "assets.json",
  );
  const missingOptionalMedia: string[] = [];
  for (const asset of assets) {
    await assertNoSymlinkParents(root, `${entry.sourceRoot}/${asset.source}`);
    const exists = await regularFile(path.join(sourceRoot, asset.source));
    if (!exists && asset.optional) missingOptionalMedia.push(asset.path);
    if (!exists && !asset.optional)
      incomplete(entry.manifest.packageId, asset.source);
  }
  if (entry.manifest.packageType === "duel-core") {
    const production = entry.sourceRoot === "content/duel-core";
    const required = production
      ? ([
          [
            "engine/ocgcore.sync.wasm",
            "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm",
          ],
          [
            "engine/vendor-manifest.json",
            "vendor/ocgcore-wasm/0.1.2/vendor-manifest.json",
          ],
        ] as const)
      : ([
          [
            "engine/ocgcore.sync.wasm",
            `${entry.sourceRoot}/engine/ocgcore.sync.wasm`,
          ],
          [
            "engine/vendor-manifest.json",
            `${entry.sourceRoot}/engine/vendor-manifest.json`,
          ],
        ] as const);
    for (const [, source] of required) {
      await assertNoSymlinkParents(root, source);
      if (!(await regularFile(safe(root, source))))
        incomplete(entry.manifest.packageId, source);
    }
    return emptySource(
      entry,
      sourceRoot,
      config,
      required.map(([assetPath, source]) => ({
        path: assetPath,
        source: path
          .relative(sourceRoot, safe(root, source))
          .split(path.sep)
          .join("/"),
        mime: assetPath.endsWith(".wasm")
          ? "application/wasm"
          : "application/json",
        optional: false,
      })),
      [],
    );
  }
  if (entry.manifest.packageType === "card-library") {
    const cards =
      catalog?.cards ??
      (await requiredArray<CardRow>(
        sourceRoot,
        "cards.json",
        entry.manifest.packageId,
      ));
    const texts =
      catalog?.texts ??
      (await requiredArray<TextRow>(
        sourceRoot,
        "card-texts.json",
        entry.manifest.packageId,
      ));
    const sets =
      globalSets?.sets ??
      (await requiredArray<SetRow>(
        sourceRoot,
        "sets.json",
        entry.manifest.packageId,
      ));
    const setCards =
      globalSets?.setCards ??
      (await requiredArray<SetCardRow>(
        sourceRoot,
        "set-cards.json",
        entry.manifest.packageId,
      ));
    const scriptsRoot = path.join(sourceRoot, "scripts");
    await assertNoSymlinkParents(root, `${entry.sourceRoot}/scripts`);
    let scriptNames: string[];
    try {
      scriptNames = catalog ? [] : (await readdir(scriptsRoot)).sort(compare);
    } catch (error) {
      if (isMissing(error)) incomplete(entry.manifest.packageId, "scripts");
      throw error;
    }
    const scripts = catalog ? [...catalog.scripts] : [];
    for (const name of scriptNames) {
      if (!/^[A-Za-z0-9_-]+\.lua$/.test(name))
        incomplete(entry.manifest.packageId, `scripts/${name}`);
      const file = path.join(scriptsRoot, name);
      if (!(await regularFile(file)))
        incomplete(entry.manifest.packageId, `scripts/${name}`);
      scripts.push({
        name,
        source: await readFile(file, "utf8"),
        sha256: await hashFile(file),
      });
    }
    return {
      manifest: entry.manifest,
      root: sourceRoot,
      config: projectedConfig?.config ?? config,
      cards,
      texts,
      scripts,
      sets,
      setCards,
      decks: [],
      opponents: [],
      limits: [],
      stories: [],
      assets,
      missingOptionalMedia: missingOptionalMedia.sort(compare),
      excludedSetMemberships: globalSets?.excludedSetMemberships ?? [],
      rarityWarnings: globalSets?.rarityWarnings ?? [],
      inventoryOnlyScripts: projectedConfig?.inventoryOnlyScripts ?? [],
    };
  }
  const decks = await requiredArray<DeckRow>(
    sourceRoot,
    "decks.json",
    entry.manifest.packageId,
  );
  const opponents = await requiredArray<OpponentRow>(
    sourceRoot,
    "opponents.json",
    entry.manifest.packageId,
  );
  const limits =
    entry.sourceRoot === "assets/content/chapter-01"
      ? await normalizedChapterLimits(
          root,
          prior
            .find((source) => source.manifest.packageId === "card-library")!
            .cards.map(({ code }) => code),
          await optionalJson<LimitRow[]>(
            sourceRoot,
            "limits.json",
            [],
            entry.manifest.packageId,
          ),
        )
      : await requiredArray<LimitRow>(
          sourceRoot,
          "limits.json",
          entry.manifest.packageId,
        );
  const stories =
    entry.manifest.packageType === "chapter"
      ? await requiredArray<unknown>(
          sourceRoot,
          "story-documents.json",
          entry.manifest.packageId,
        )
      : [];
  const projected =
    entry.sourceRoot === "assets/content/chapter-01"
      ? projectChapterStories(stories, entry.manifest.packageId, config, assets)
      : { stories, missingOptionalMedia: [] };
  return {
    ...emptySource(
      entry,
      sourceRoot,
      config,
      assets,
      [
        ...new Set([
          ...missingOptionalMedia,
          ...projected.missingOptionalMedia,
        ]),
      ].sort(compare),
    ),
    decks,
    opponents,
    limits,
    stories: projected.stories,
  };
}

function emptySource(
  entry: { manifest: PackageManifest },
  root: string,
  config: unknown,
  assets: readonly AssetSource[],
  missingOptionalMedia: readonly string[],
): PackageSource {
  return {
    manifest: entry.manifest,
    root,
    config,
    cards: [],
    texts: [],
    scripts: [],
    sets: [],
    setCards: [],
    decks: [],
    opponents: [],
    limits: [],
    stories: [],
    assets,
    missingOptionalMedia,
    excludedSetMemberships: [],
    rarityWarnings: [],
    inventoryOnlyScripts: [],
  };
}

function validateCrossPackageSources(sources: readonly PackageSource[]): void {
  const libraries = sources.filter(
    ({ manifest }) => manifest.packageType === "card-library",
  );
  const codes = new Set(
    libraries.flatMap((library) => library.cards.map(({ code }) => code)),
  );
  const setIds = new Set<string>();
  for (const library of libraries) {
    unique(
      library.sets.map(({ id }) => id),
      library.manifest.packageId,
      "sets.json",
    );
    for (const set of library.sets) {
      if (setIds.has(set.id))
        throw new ExpectedFailure(
          failed("PACKAGE_IDENTITY_CONFLICT", library.manifest.packageId),
        );
      setIds.add(set.id);
    }
  }
  const identities = new Map<string, string>();
  for (const library of libraries) {
    for (const [id, value] of [
      ...library.cards.map((row) => [`card:${row.code}`, canonicalJson(row)]),
      ...library.texts.map((row) => [
        `text:${row.cardCode}:${row.locale}`,
        canonicalJson(row),
      ]),
      ...library.scripts.map((row) => [`script:${row.name}`, row.source]),
    ]) {
      if (identities.has(id!) && identities.get(id!) !== value)
        throw new ExpectedFailure(
          failed("PACKAGE_IDENTITY_CONFLICT", library.manifest.packageId),
        );
      identities.set(id!, value!);
    }
    unique(
      library.cards.map(({ code }) => String(code)),
      library.manifest.packageId,
      "cards.json",
    );
    const textKeys = library.texts.map(
      ({ cardCode, locale }) => `${cardCode}:${locale}`,
    );
    unique(textKeys, library.manifest.packageId, "card-texts.json");
    for (const text of library.texts)
      if (!codes.has(text.cardCode))
        incomplete(library.manifest.packageId, "card-texts.json");
    unique(
      library.scripts.map(({ name }) => name),
      library.manifest.packageId,
      "scripts",
    );
    unique(
      library.setCards.map((row) =>
        JSON.stringify([
          row.setId,
          row.cardCode,
          row.printingCode,
          row.sourceRarity,
          row.sourceRarityCode,
        ]),
      ),
      library.manifest.packageId,
      "set-cards.json",
    );
    const config = library.config as {
      locales?: unknown;
      requiredScripts?: { cards?: unknown; globals?: unknown };
    };
    if (!Array.isArray(config.locales))
      incomplete(library.manifest.packageId, "config.json");
    for (const card of library.cards) {
      if (card.alias !== 0 && !codes.has(card.alias))
        incomplete(library.manifest.packageId, "cards.json");
      for (const locale of config.locales)
        if (!textKeys.includes(`${card.code}:${locale}`))
          incomplete(library.manifest.packageId, "card-texts.json");
    }
    const scriptNames = new Set(library.scripts.map(({ name }) => name));
    const required = config.requiredScripts;
    if (
      !required ||
      !Array.isArray(required.cards) ||
      !Array.isArray(required.globals)
    )
      incomplete(library.manifest.packageId, "config.json");
    for (const name of [...required.cards, ...required.globals])
      if (typeof name !== "string" || !scriptNames.has(name))
        incomplete(library.manifest.packageId, `scripts/${String(name)}`);
    for (const name of required.cards) {
      const match =
        typeof name === "string" ? /^c([1-9]\d*)\.lua$/.exec(name) : null;
      if (!match || !codes.has(Number(match[1])))
        incomplete(library.manifest.packageId, `scripts/${String(name)}`);
    }
    unique(
      library.sets.map(({ id }) => id),
      library.manifest.packageId,
      "sets.json",
    );
    const assetPaths = new Set(library.assets.map(({ path }) => path));
    for (const set of library.sets)
      if (set.imageAssetPath !== null && !assetPaths.has(set.imageAssetPath))
        incomplete(library.manifest.packageId, "sets.json");
    for (const row of library.setCards)
      if (!codes.has(row.cardCode) || !setIds.has(row.setId))
        incomplete(library.manifest.packageId, "set-cards.json");
  }
  for (const source of sources.filter(
    ({ manifest }) =>
      manifest.packageType === "freeplay" || manifest.packageType === "chapter",
  )) {
    const deckIds = new Set(source.decks.map(({ id }) => id));
    unique(
      source.decks.map(({ id }) => id),
      source.manifest.packageId,
      "decks.json",
    );
    unique(
      source.limits.map(({ cardCode }) => String(cardCode)),
      source.manifest.packageId,
      "limits.json",
    );
    unique(
      source.stories.map((story) =>
        String(isRecord(story) ? story.contentId : undefined),
      ),
      source.manifest.packageId,
      "story-documents.json",
    );
    unique(
      source.opponents.map(({ id }) => id),
      source.manifest.packageId,
      "opponents.json",
    );
    const allowed = new Set<PackageId>();
    const visit = (id: PackageId): void => {
      if (allowed.has(id)) return;
      allowed.add(id);
      for (const dependency of sources.find(
        (item) => item.manifest.packageId === id,
      )?.manifest.dependencies ?? [])
        visit(dependency.packageId);
    };
    visit(source.manifest.packageId);
    const availableLibraries = libraries.filter((library) =>
      allowed.has(library.manifest.packageId),
    );
    const codes = new Set(
      availableLibraries.flatMap((library) =>
        library.cards.map((card) => card.code),
      ),
    );
    const setIds = new Set(
      availableLibraries.flatMap((library) =>
        library.sets.map((set) => set.id),
      ),
    );
    for (const deck of source.decks)
      for (const code of [
        ...deck.cards.main,
        ...deck.cards.extra,
        ...deck.cards.side,
      ])
        if (!codes.has(code))
          incomplete(source.manifest.packageId, "decks.json");
    for (const opponent of source.opponents)
      if (!deckIds.has(opponent.deckId))
        incomplete(source.manifest.packageId, "opponents.json");
    for (const limit of source.limits)
      if (!codes.has(limit.cardCode))
        incomplete(source.manifest.packageId, "limits.json");
    const config = source.config as {
      defaults?: { starterDeckId?: unknown; opponentId?: unknown };
      setIds?: unknown;
      storyContentId?: unknown;
      mapAssetPath?: unknown;
    };
    if (
      !config.defaults ||
      !deckIds.has(String(config.defaults.starterDeckId)) ||
      !source.opponents.some(({ id }) => id === config.defaults?.opponentId)
    )
      incomplete(source.manifest.packageId, "config.json");
    if (source.manifest.packageType === "chapter") {
      if (
        config.mapAssetPath !== null &&
        !source.assets.some(({ path }) => path === config.mapAssetPath)
      )
        incomplete(source.manifest.packageId, "config.json");
      if (
        !Array.isArray(config.setIds) ||
        config.setIds.some((id) => typeof id !== "string" || !setIds.has(id))
      )
        incomplete(source.manifest.packageId, "config.json");
      const storyIds = source.stories.map((story) =>
        isRecord(story) ? story.contentId : undefined,
      );
      if (
        config.storyContentId !== null &&
        !storyIds.includes(config.storyContentId)
      )
        incomplete(source.manifest.packageId, "story-documents.json");
    }
  }
}

async function writePackage(
  root: string,
  source: PackageSource,
): Promise<ExportReceipt> {
  const relative = `generated/content-packages/${packageFileName(source.manifest)}`;
  const output = safe(root, relative);
  await assertNoSymlinkParents(root, relative);
  await mkdir(path.dirname(output), { recursive: true });
  const temp = `${output}.${randomUUID()}.tmp`;
  const database = new DatabaseSync(temp);
  try {
    database.exec(PACKAGE_SCHEMA_SQL);
    if (source.manifest.packageType === "card-library")
      database.exec(CARD_LIBRARY_SCHEMA_SQL);
    else if (source.manifest.packageType === "freeplay")
      database.exec(FREEPLAY_SCHEMA_SQL);
    else if (source.manifest.packageType === "chapter")
      database.exec(CHAPTER_SCHEMA_SQL);
    database.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;");
    insertCommon(database, source);
    if (source.manifest.packageType === "card-library")
      insertLibrary(database, source);
    else if (
      source.manifest.packageType === "freeplay" ||
      source.manifest.packageType === "chapter"
    )
      insertPlay(database, source);
    database.exec("COMMIT;");
  } catch (error) {
    try {
      database.exec("ROLLBACK;");
    } catch {
      /* database may not have active transaction */
    }
    throw error;
  } finally {
    database.close();
  }
  const verification = await verifyPackageFile(
    root,
    path.relative(root, temp).split(path.sep).join("/"),
  );
  if (verification.kind === "failed") {
    await rm(temp, { force: true });
    throw new ExpectedFailure(verification);
  }
  const existing = await fileHash(output);
  if (existing !== null) {
    await rm(temp, { force: true });
    if (existing !== verification.value.sha256)
      throw new ExpectedFailure(
        failed(
          "PACKAGE_IDENTITY_CONFLICT",
          source.manifest.packageId,
          relative,
        ),
      );
  } else {
    try {
      await link(temp, output);
    } catch (error) {
      const raced = await fileHash(output);
      if (raced !== verification.value.sha256) throw error;
    } finally {
      await rm(temp, { force: true });
    }
  }
  const info = await stat(output);
  return Object.freeze({
    packageId: source.manifest.packageId,
    version: source.manifest.version,
    path: relative,
    bytes: info.size,
    sha256: verification.value.sha256,
    missingOptionalMedia: Object.freeze([...source.missingOptionalMedia]),
    excludedSetMemberships: Object.freeze([...source.excludedSetMemberships]),
    rarityWarnings: Object.freeze([...source.rarityWarnings]),
    inventoryOnlyScripts: Object.freeze([...source.inventoryOnlyScripts]),
  });
}

function packageFileName(manifest: PackageManifest): string {
  return `${manifest.packageId}-${manifest.version}.sqlite`;
}

function insertCommon(database: DatabaseSync, source: PackageSource): void {
  const manifest = source.manifest;
  database
    .prepare("INSERT INTO package_manifest VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      manifest.packageId,
      manifest.packageType,
      manifest.version,
      manifest.schemaVersion,
      JSON.stringify(
        [...manifest.dependencies].sort((a, b) =>
          compare(a.packageId, b.packageId),
        ),
      ),
      manifest.createdAt,
    );
  database
    .prepare("INSERT INTO package_meta VALUES ('config', ?)")
    .run(canonicalJson(source.config));
  const insert = database.prepare("INSERT INTO assets VALUES (?, ?, ?, ?, ?)");
  for (const asset of [...source.assets].sort((a, b) =>
    compare(a.path, b.path),
  )) {
    const file = path.resolve(source.root, asset.source);
    if (
      !path.resolve(file).startsWith(path.resolve(source.root)) &&
      !file.includes(
        `${path.sep}vendor${path.sep}ocgcore-wasm${path.sep}0.1.2${path.sep}`,
      )
    )
      incomplete(source.manifest.packageId, asset.source);
    if (!asset.optional || requireExisting(file)) {
      const bytes = requireRead(file, source.manifest.packageId, asset.source);
      if (!validAssetBytes(asset, bytes))
        incomplete(source.manifest.packageId, asset.source);
      insert.run(asset.path, asset.mime, bytes.length, hashBytes(bytes), bytes);
    }
  }
}
function insertLibrary(database: DatabaseSync, source: PackageSource): void {
  const card = database.prepare("INSERT INTO cards VALUES (?, ?)");
  for (const row of [...source.cards].sort((a, b) => a.code - b.code))
    card.run(row.code, canonicalJson(row));
  const text = database.prepare(
    "INSERT INTO card_texts VALUES (?, ?, ?, ?, ?)",
  );
  for (const row of [...source.texts].sort(
    (a, b) => a.cardCode - b.cardCode || compare(a.locale, b.locale),
  ))
    text.run(
      row.cardCode,
      row.locale,
      row.name,
      row.description,
      canonicalJson(row.strings),
    );
  const script = database.prepare("INSERT INTO scripts VALUES (?, ?, ?)");
  for (const row of source.scripts)
    script.run(row.name, row.source, row.sha256);
  const set = database.prepare("INSERT INTO sets VALUES (?, ?)");
  for (const row of [...source.sets].sort((a, b) => compare(a.id, b.id)))
    set.run(row.id, canonicalJson(row));
  const setCard = database.prepare(
    "INSERT INTO set_cards VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const row of [...source.setCards].sort(
    (a, b) =>
      compare(a.setId, b.setId) ||
      a.cardCode - b.cardCode ||
      compare(a.printingCode, b.printingCode) ||
      compare(a.sourceRarity, b.sourceRarity) ||
      compare(a.sourceRarityCode, b.sourceRarityCode),
  ))
    setCard.run(
      row.setId,
      row.cardCode,
      row.printingCode,
      row.rarity,
      row.sourceRarity,
      row.sourceRarityCode,
    );
  const search = database.prepare("INSERT INTO card_search VALUES (?, ?, ?)");
  for (const row of [...source.texts].sort((a, b) =>
    compare(
      `${a.locale}:${normalize(a.name)}:${a.cardCode}`,
      `${b.locale}:${normalize(b.name)}:${b.cardCode}`,
    ),
  ))
    search.run(row.locale, row.cardCode, normalize(row.name));
}
function insertPlay(database: DatabaseSync, source: PackageSource): void {
  const deck = database.prepare("INSERT INTO decks VALUES (?, ?, ?)");
  for (const row of [...source.decks].sort((a, b) => compare(a.id, b.id)))
    deck.run(row.id, row.name, canonicalJson(row.cards));
  const opponent = database.prepare(
    "INSERT INTO opponents VALUES (?, ?, ?, ?, ?)",
  );
  for (const row of [...source.opponents].sort((a, b) => compare(a.id, b.id)))
    opponent.run(row.id, row.name, row.line, row.deckId, row.policyId);
  const limits = database.prepare(
    `INSERT INTO ${source.manifest.packageType === "freeplay" ? "freeplay_card_limits" : "chapter_card_limits"} VALUES (?, ?)`,
  );
  for (const row of [...source.limits].sort((a, b) => a.cardCode - b.cardCode))
    limits.run(row.cardCode, row.deckLimit);
  if (source.manifest.packageType === "chapter") {
    const story = database.prepare("INSERT INTO story_documents VALUES (?, ?)");
    for (const row of [...source.stories].sort((a, b) =>
      compare(
        String((a as { contentId?: unknown }).contentId),
        String((b as { contentId?: unknown }).contentId),
      ),
    ))
      story.run((row as { contentId: string }).contentId, canonicalJson(row));
  }
}

export async function verifyPackageFile(
  root: string,
  relative: string,
): Promise<
  StorageResult<{
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
    readonly packageId: PackageId;
  }>
> {
  let database: DatabaseSync | null = null;
  try {
    const file = safe(root, relative);
    await assertNoSymlinkParents(root, relative);
    database = new DatabaseSync(file, { readOnly: true });
    const validated = validatePackageDatabase({
      all(sql, parameters = []) {
        return database!.prepare(sql).all(...parameters) as never;
      },
    });
    if (validated.kind === "failed") return validated;
    const rows = database
      .prepare("SELECT path, sha256 FROM assets ORDER BY path")
      .all() as { path: string; sha256: string }[];
    const statement = database.prepare("SELECT data FROM assets WHERE path=?");
    for (const row of rows) {
      const asset = statement.get(row.path) as
        { data?: Uint8Array } | undefined;
      if (
        !(asset?.data instanceof Uint8Array) ||
        hashBytes(asset.data) !== row.sha256
      )
        return failed(
          "PACKAGE_INTEGRITY_FAILED",
          validated.value.manifest.packageId,
          row.path,
        );
    }
    if (validated.value.manifest.packageType === "card-library") {
      for (const row of database
        .prepare("SELECT name, source, sha256 FROM scripts ORDER BY name")
        .iterate()) {
        if (
          typeof row.source !== "string" ||
          hashBytes(new TextEncoder().encode(row.source)) !== row.sha256
        )
          return failed(
            "PACKAGE_INTEGRITY_FAILED",
            validated.value.manifest.packageId,
            `scripts/${String(row.name)}`,
          );
      }
    }
    database.close();
    database = null;
    const info = await stat(file);
    return {
      kind: "ok",
      value: {
        path: relative,
        bytes: info.size,
        sha256: await hashFile(file),
        packageId: validated.value.manifest.packageId,
      },
    };
  } catch {
    return failed("PACKAGE_INTEGRITY_FAILED", undefined, relative);
  } finally {
    database?.close();
  }
}

async function requiredArray<T>(
  root: string,
  relative: string,
  packageId: PackageId,
): Promise<T[]> {
  const value = await json(root, relative, packageId);
  if (!Array.isArray(value)) incomplete(packageId, relative);
  return value as T[];
}
async function json(
  root: string,
  relative: string,
  packageId: PackageId,
): Promise<unknown> {
  try {
    return JSON.parse(
      await readFile(path.join(root, relative), "utf8"),
    ) as unknown;
  } catch (error) {
    if (isMissing(error) || error instanceof SyntaxError)
      incomplete(packageId, relative);
    throw error;
  }
}
async function optionalJson<T>(
  root: string,
  relative: string,
  fallback: T,
  packageId: PackageId,
): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(root, relative), "utf8")) as T;
  } catch (error) {
    if (isMissing(error)) return fallback;
    if (error instanceof SyntaxError) incomplete(packageId, relative);
    throw error;
  }
}
async function requiredFile(
  root: string,
  relative: string,
  packageId: PackageId,
): Promise<void> {
  if (!(await regularFile(path.join(root, relative))))
    incomplete(packageId, relative);
}
async function regularFile(file: string): Promise<boolean> {
  try {
    const info = await lstat(file);
    return info.isFile() && !info.isSymbolicLink();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
function requireExisting(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
function requireRead(
  file: string,
  packageId: PackageId,
  relative: string,
): Uint8Array {
  try {
    return readFileSync(file);
  } catch (error) {
    if (isMissing(error)) incomplete(packageId, relative);
    throw error;
  }
}
function validAssetBytes(asset: AssetSource, bytes: Uint8Array): boolean {
  if (asset.mime === "application/wasm")
    return (
      bytes.length >= 8 &&
      bytes[0] === 0 &&
      bytes[1] === 0x61 &&
      bytes[2] === 0x73 &&
      bytes[3] === 0x6d
    );
  if (asset.mime === "application/json") {
    try {
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      return true;
    } catch {
      return false;
    }
  }
  if (asset.mime === "image/jpeg")
    return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (asset.mime === "image/png")
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  if (asset.mime === "image/webp")
    return (
      bytes.length >= 12 &&
      new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
    );
  if (asset.mime === "image/svg+xml") {
    try {
      return /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/u.test(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      return false;
    }
  }
  return false;
}

function validAssetSource(value: unknown): value is AssetSource {
  return (
    isRecord(value) &&
    exactKeys(value, ["mime", "optional", "path", "source"]) &&
    validAssetPath(value.path) &&
    validAssetPath(value.source) &&
    typeof value.mime === "string" &&
    value.mime.length > 0 &&
    typeof value.optional === "boolean"
  );
}
function validSourceRoot(value: string, packageId: PackageId): boolean {
  return (
    value ===
      (packageId === "duel-core" || packageId === "freeplay"
        ? `content/${packageId}`
        : `assets/content/${packageId}`) ||
    value === `tests/fixtures/sqlite/sources/${packageId}`
  );
}
function validRelative(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    value
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}
function safe(root: string, relative: string): string {
  if (!validRelative(relative)) throw new Error("unsafe path");
  const result = path.resolve(root, relative);
  if (!result.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error("unsafe path");
  return result;
}
function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}
function unique(
  values: readonly string[],
  packageId: PackageId,
  sourcePath: string,
): void {
  if (new Set(values).size !== values.length) incomplete(packageId, sourcePath);
}
function incomplete(packageId: PackageId, sourcePath: string): never {
  throw new ExpectedFailure(
    failed("PACKAGE_SOURCE_INCOMPLETE", packageId, sourcePath),
  );
}
function failed(
  code:
    | "PACKAGE_INVALID"
    | "PACKAGE_IDENTITY_CONFLICT"
    | "PACKAGE_INTEGRITY_FAILED"
    | "PACKAGE_SOURCE_INCOMPLETE",
  packageId?: PackageId,
  sourcePath?: string,
): StorageResult<never> {
  return {
    kind: "failed",
    error: {
      code,
      ...(packageId ? { packageId } : {}),
      ...(sourcePath ? { path: sourcePath } : {}),
    },
  };
}
function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort(compare)
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function hashBytes(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}
async function fileHash(file: string): Promise<string | null> {
  try {
    return await hashFile(file);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
