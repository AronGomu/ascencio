import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CriticalSnapshot,
  SnapshotCard,
  SnapshotSet,
} from "../../../src/storage/contracts/critical-snapshot.ts";
import type { PackageManifest } from "../../../src/storage/contracts/package.ts";
import { validAssetPath } from "../../../src/storage/schema/package-database.ts";
import {
  OCG_ATTRIBUTE,
  OCG_RACE,
  OCG_TYPE,
} from "../../../src/cards/classification/index.ts";
import { verifyPackageFile } from "../sqlite-content/index.ts";
import type { SourceManifest } from "./source-manifest.ts";

/** Explicit content-only conversion. Never opens the installed registry or user data. */
export async function exportSqliteSource(
  repository: string,
  input: string,
  output: string,
): Promise<SourceManifest> {
  const verified = await verifyPackageFile(repository, input);
  if (verified.kind === "failed")
    throw new Error(`CONVERSION_INPUT_INVALID: ${verified.error.code}`);
  // Exclusive root creation prevents accidental replacement of an authored pack.
  await mkdir(output);
  const database = new DatabaseSync(path.resolve(repository, input), {
    readOnly: true,
  });
  try {
    const row = database.prepare("SELECT * FROM package_manifest").get()!;
    const manifest = {
      packageId: row.package_id,
      packageType: row.package_type,
      version: row.version,
      schemaVersion: row.schema_version,
      dependencies: JSON.parse(String(row.dependencies_json)),
      createdAt: row.created_at,
    } as PackageManifest;
    const source: SourceManifest = {
      format: "ascencio-readable-pack",
      schemaVersion: 1,
      manifest,
      config: "config.json",
      cards: [],
      scripts: [],
      sets: [],
      decks: [],
      opponents: [],
      rules: "rules.json",
      stories: [],
      media: [],
      engine: [],
    };
    async function write(file: string, content: string | Uint8Array) {
      if (!validAssetPath(file))
        throw new Error(`CONVERSION_PATH_INVALID: ${file}`);
      const target = path.join(output, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, { flag: "wx" });
    }
    async function json(file: string, value: unknown) {
      await write(file, `${JSON.stringify(value, null, 2)}\n`);
    }
    await json(
      source.config,
      JSON.parse(
        String(
          database
            .prepare("SELECT value_json FROM package_meta WHERE key='config'")
            .get()!.value_json,
        ),
      ),
    );
    const cardLibrary = manifest.packageType === "card-library";
    if (cardLibrary) {
      const cards: string[] = [];
      const scripts: { name: string; path: string }[] = [];
      const codes = new Set<number>();
      for (const card of database
        .prepare("SELECT code, definition_json FROM cards ORDER BY code")
        .iterate()) {
        const definition = JSON.parse(
          String(card.definition_json),
        ) as SnapshotCard["definition"];
        codes.add(definition.code);
        const texts = database
          .prepare(
            "SELECT locale,name,description,strings_json FROM card_texts WHERE card_code=? ORDER BY locale",
          )
          .all(definition.code)
          .map((t) => ({
            locale: String(t.locale),
            name: String(t.name),
            description: String(t.description),
            strings: JSON.parse(String(t.strings_json)),
          }));
        const file = `cards/${definition.code}/card.json`;
        cards.push(file);
        await json(file, {
          schemaVersion: 1,
          id: `official:${definition.code}`,
          engine: definition,
          classification: {
            types: names(OCG_TYPE, BigInt(definition.type)),
            attributes: names(OCG_ATTRIBUTE, BigInt(definition.attribute)),
            races: names(OCG_RACE, BigInt(definition.race)),
          },
          texts,
        });
      }
      for (const script of database
        .prepare("SELECT name,source FROM scripts ORDER BY name")
        .iterate()) {
        const name = String(script.name);
        const code = /^c([1-9][0-9]*)\.lua$/.exec(name)?.[1];
        const file =
          code !== undefined && codes.has(Number(code))
            ? `cards/${code}/effect.lua`
            : `scripts/${encodeURIComponent(name)}`;
        await write(file, String(script.source));
        scripts.push({ name, path: file });
      }
      const sets: string[] = [];
      for (const set of database
        .prepare("SELECT id,metadata_json FROM sets ORDER BY id")
        .iterate()) {
        const metadata = JSON.parse(String(set.metadata_json)) as Omit<
          SnapshotSet,
          "cards"
        >;
        const cards = database
          .prepare(
            "SELECT sc.card_code,ct.name,sc.rarity,sc.printing_code,sc.source_rarity,sc.source_rarity_code FROM set_cards sc JOIN card_texts ct ON ct.card_code=sc.card_code AND ct.locale='en' WHERE sc.set_id=? ORDER BY sc.card_code,sc.printing_code,sc.source_rarity,sc.source_rarity_code",
          )
          .all(String(set.id))
          .map((c) => ({
            code: c.card_code,
            name: c.name,
            rarity: c.rarity,
            printingCode: c.printing_code,
            sourceRarity: c.source_rarity,
            sourceRarityCode: c.source_rarity_code,
          }));
        const file = `sets/${encodeURIComponent(String(set.id))}.json`;
        await json(file, { ...metadata, cards });
        sets.push(file);
      }
      Object.assign(source, { cards, scripts, sets });
    }
    let limits: unknown[] = [];
    if (
      manifest.packageType === "freeplay" ||
      manifest.packageType === "chapter"
    ) {
      const decks: string[] = [],
        opponents: string[] = [],
        stories: string[] = [];
      for (const deck of database
        .prepare("SELECT * FROM decks ORDER BY id")
        .iterate()) {
        const file = `decks/${encodeURIComponent(String(deck.id))}.json`;
        await json(file, {
          id: deck.id,
          name: deck.name,
          ...JSON.parse(String(deck.cards_json)),
        });
        decks.push(file);
      }
      for (const opponent of database
        .prepare("SELECT * FROM opponents ORDER BY id")
        .iterate()) {
        const file = `opponents/${encodeURIComponent(String(opponent.id))}.json`;
        await json(file, {
          id: opponent.id,
          name: opponent.name,
          line: opponent.line,
          deckId: opponent.deck_id,
          policyId: opponent.policy_id,
        });
        opponents.push(file);
      }
      const table =
        manifest.packageType === "freeplay"
          ? "freeplay_card_limits"
          : "chapter_card_limits";
      limits = database
        .prepare(`SELECT * FROM ${table} ORDER BY card_code`)
        .all()
        .map((l) => [l.card_code, l.deck_limit]);
      if (manifest.packageType === "chapter") {
        for (const story of database
          .prepare("SELECT * FROM story_documents ORDER BY id")
          .iterate()) {
          const file = `stories/${encodeURIComponent(String(story.id))}.json`;
          await json(file, JSON.parse(String(story.payload_json)));
          stories.push(file);
        }
      }
      Object.assign(source, { decks, opponents, stories });
    }
    await json(source.rules, { schemaVersion: 1, quantityByCode: limits });
    const media: CriticalSnapshot["media"][number][] = [],
      engine: SourceManifest["engine"][number][] = [];
    // One BLOB at a time; the full artwork catalog never resides in conversion memory.
    for (const asset of database
      .prepare("SELECT path,mime,data FROM assets ORDER BY path")
      .iterate()) {
      const logical = String(asset.path);
      if (!validAssetPath(logical) || !(asset.data instanceof Uint8Array))
        throw new Error("CONVERSION_ASSET_INVALID");
      const file =
        manifest.packageType === "duel-core" ? logical : mediaFile(logical);
      await write(file, asset.data);
      if (manifest.packageType === "duel-core")
        engine.push({ path: logical, file });
      else media.push({ id: logical, path: file, mime: String(asset.mime) });
    }
    Object.assign(source, { media, engine });
    await json("pack.json", source);
    return source;
  } finally {
    database.close();
  }
}
function names(
  masks: Readonly<Record<string, number | bigint>>,
  value: bigint,
): string[] {
  return Object.entries(masks)
    .filter(([, mask]) => (value & BigInt(mask)) === BigInt(mask))
    .map(([name]) => name.toLowerCase());
}
function mediaFile(logical: string): string {
  const match = /^cards\/(full|cropped)\/([1-9][0-9]*)\.jpg$/.exec(logical);
  return match
    ? `cards/${match[2]}/${match[1] === "full" ? "artwork" : "cropped"}.jpg`
    : `media/${logical}`;
}
