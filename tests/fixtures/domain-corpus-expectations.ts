import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import type { RuntimeCardRecord } from "../../scripts/lib/sqlite-content/normalized-card-record.ts";
import type { ChapterConfig, DuelCoreConfig } from "../../src/storage/index.ts";

const root = "assets/content";
export const sourceJson = <T>(path: string): T =>
  JSON.parse(readFileSync(`${root}/${path}`, "utf8")) as T;
export const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

/** Independent oracle: raw normalized files only, never fixture/projector output. */
export function domainCorpusExpectations() {
  const readShards = <T>(directory: string): T[] =>
    readdirSync(`${root}/${directory}`)
      .sort()
      .flatMap((file) => sourceJson<T[]>(`${directory}/${file}`));
  const records = readShards<RuntimeCardRecord>(
    "card-library/data/catalog/cards",
  );
  const codes = records.map(({ code }) => code).sort((a, b) => a - b);
  const config = sourceJson<ChapterConfig>("chapter-01/config.json");
  const source = sourceJson<{
    sets: {
      name: string;
      tcgReleaseDate: string | null;
      cards: { id: number; printings: { rarity: string }[] }[];
    }[];
  }>("card-library/authoring/card-set-source.json");
  const selections = sourceJson<{ chapters: { setNames: string[] }[] }>(
    "chapter-01/authoring/chapter-selections.json",
  );
  const corrections = sourceJson<{
    aliases: { sourceCode: number; runtimeCode: number }[];
    excludedSetNames: string[];
    excludedCardCodes: number[];
  }>("chapter-01/authoring/chapter-one-corrections.json");
  const aliases = new Map(
    corrections.aliases.map(({ sourceCode, runtimeCode }) => [
      sourceCode,
      runtimeCode,
    ]),
  );
  const selected = new Set(
    source.sets
      .filter(
        (set) =>
          set.tcgReleaseDate !== null &&
          selections.chapters[0]!.setNames.includes(set.name) &&
          !corrections.excludedSetNames.includes(set.name),
      )
      .flatMap((set) =>
        set.cards
          .filter(({ id }) => !corrections.excludedCardCodes.includes(id))
          .map(({ id }) => aliases.get(id) ?? id),
      ),
  );
  const chapterCodes = records
    .filter(
      (card) =>
        selected.has(card.code) &&
        (card.type & 0x4000) === 0 &&
        (card.ot & 8) === 0,
    )
    .map(({ code }) => code)
    .sort((a, b) => a - b);
  const shop = sourceJson<{ sets: { id: string; name: string }[] }>(
    "card-library/authoring/shop-sets.v1.json",
  );
  const setFiles = readdirSync(`${root}/card-library/images/sets`);
  const sets = config.setIds.map((id) => {
    const row = source.sets.find(
      ({ name }) =>
        (shop.sets.find((set) => set.name === name)?.id ??
          `set-${digest(name).slice(0, 16)}`) === id,
    )!;
    return {
      id,
      name: row.name,
      releaseYear: Number(row.tcgReleaseDate!.slice(0, 4)),
      imageAssetPath: `sets/${setFiles.find((file) => file.slice(0, file.lastIndexOf(".")) === id) ?? `${id}.jpg`}`,
    };
  });
  const scripts = Object.assign(
    {},
    ...readdirSync(`${root}/card-library/data/scripts/cards`)
      .sort()
      .map((file) =>
        sourceJson<Record<string, string>>(
          `card-library/data/scripts/cards/${file}`,
        ),
      ),
    sourceJson<Record<string, string>>(
      "card-library/data/scripts/globals.json",
    ),
  ) as Record<string, string>;
  const scriptHashes = Object.fromEntries(
    Object.entries(scripts)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([name, source]) => [name, digest(source)]),
  );
  const documents = sourceJson<
    (Record<string, unknown> & { mapImage: { packId: string; path: string } })[]
  >("chapter-01/story-documents.json");
  const { mapImage, ...document } = documents[0]!;
  return {
    codes,
    chapterCodes,
    config,
    sets,
    scriptHashes,
    document,
    mapImage,
    globalSetCount: source.sets.length,
    ghostCodes: [
      ...new Set(
        source.sets.flatMap(({ cards }) =>
          cards
            .filter(
              (card) =>
                codes.includes(card.id) &&
                card.printings.some(({ rarity }) => rarity === "Ghost Rare"),
            )
            .map(({ id }) => id),
        ),
      ),
    ],
    core: sourceJson<DuelCoreConfig>("duel-core/config.json"),
    decks: sourceJson<
      {
        id: string;
        name: string;
        cards: { main: number[]; extra: number[]; side: number[] };
      }[]
    >("chapter-01/decks.json").map(({ cards, ...deck }) => ({
      ...deck,
      ...cards,
    })),
    opponents: sourceJson<
      {
        id: string;
        name: string;
        line: string;
        deckId: string;
        policyId: string;
      }[]
    >("chapter-01/opponents.json"),
    wasm: readFileSync("vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
    vendor: readFileSync("vendor/ocgcore-wasm/0.1.2/vendor-manifest.json"),
  };
}
