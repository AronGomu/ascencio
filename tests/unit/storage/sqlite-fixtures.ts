import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  CARD_LIBRARY_SCHEMA_SQL,
  CHAPTER_SCHEMA_SQL,
  CONTENT_REGISTRY_SCHEMA_SQL,
  FREEPLAY_SCHEMA_SQL,
  PACKAGE_SCHEMA_SQL,
  USER_DATA_SCHEMA_SQL,
  type PackageId,
  type PackageManifest,
  type PackageType,
  type SqliteValue,
  type StorageSqlReader,
} from "../../../src/storage/schema/index.ts";

export const FIXTURE_ROOT = path.resolve(".tmp/manual-sqlite-t1-fixtures");
mkdirSync(FIXTURE_ROOT, { recursive: true });

export interface PackageFixture {
  readonly database: DatabaseSync;
  readonly file: string;
  readonly reader: StorageSqlReader;
  readonly manifest: PackageManifest;
}

export function sqliteReader(database: DatabaseSync): StorageSqlReader {
  return {
    all(sql, parameters = []) {
      return database.prepare(sql).all(...parameters) as ReadonlyArray<
        Readonly<Record<string, SqliteValue>>
      >;
    },
  };
}

export function packageManifest(packageId: PackageId): PackageManifest {
  const packageType: PackageType =
    packageId === "duel-core" ||
    packageId === "card-library" ||
    packageId === "freeplay"
      ? packageId
      : "chapter";
  const predecessor =
    packageId === "duel-core"
      ? null
      : packageId === "card-library"
        ? "duel-core"
        : packageId === "freeplay"
          ? "card-library"
          : packageId === "chapter-01"
            ? "freeplay"
            : `chapter-${String(Number(packageId.slice(8)) - 1).padStart(2, "0")}`;
  return {
    packageId,
    packageType,
    version: "1.0.0",
    schemaVersion: 1,
    dependencies:
      predecessor === null
        ? []
        : [
            {
              packageId: predecessor as PackageId,
              requirement: "exact",
              version: "1.0.0",
            },
          ],
    createdAt: "2026-09-24T00:00:00.000Z",
  };
}

export function createPackageFixture(
  packageId: PackageId,
  options: {
    readonly transformSchema?: (sql: string) => string;
    readonly configure?: (database: DatabaseSync) => void;
  } = {},
): PackageFixture {
  const file = path.join(
    FIXTURE_ROOT,
    `${packageId}-${crypto.randomUUID()}.sqlite`,
  );
  const database = new DatabaseSync(file);
  options.configure?.(database);
  const schema =
    PACKAGE_SCHEMA_SQL +
    (packageId === "card-library"
      ? CARD_LIBRARY_SCHEMA_SQL
      : packageId === "freeplay"
        ? FREEPLAY_SCHEMA_SQL
        : packageId.startsWith("chapter-")
          ? CHAPTER_SCHEMA_SQL
          : "");
  database.exec(options.transformSchema?.(schema) ?? schema);
  const manifest = packageManifest(packageId);
  database
    .prepare("INSERT INTO package_manifest VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      manifest.packageId,
      manifest.packageType,
      manifest.version,
      manifest.schemaVersion,
      JSON.stringify(manifest.dependencies),
      manifest.createdAt,
    );
  database
    .prepare("INSERT INTO package_meta VALUES ('config', ?)")
    .run(JSON.stringify(configFor(packageId)));
  populateOwnedRows(database, packageId);
  return { database, file, reader: sqliteReader(database), manifest };
}

export function createImportablePackageFixture(
  packageId: PackageId,
): PackageFixture {
  const fixture = createPackageFixture(packageId);
  if (packageId === "duel-core") {
    insertAsset(
      fixture.database,
      "engine/ocgcore.sync.wasm",
      "application/wasm",
      new Uint8Array([0, 97, 115, 109]),
    );
    insertAsset(
      fixture.database,
      "engine/vendor-manifest.json",
      "application/json",
      new TextEncoder().encode("{}"),
    );
  }
  if (packageId === "card-library") {
    const rows = fixture.database
      .prepare("SELECT name, source FROM scripts ORDER BY name")
      .all() as { name: string; source: string }[];
    const update = fixture.database.prepare(
      "UPDATE scripts SET sha256=? WHERE name=?",
    );
    for (const row of rows)
      update.run(
        bytesToHex(sha256(new TextEncoder().encode(row.source))),
        row.name,
      );
  }
  fixture.database.exec("VACUUM");
  return fixture;
}

export function insertAsset(
  database: DatabaseSync,
  assetPath: string,
  mime: string,
  data: Uint8Array,
): void {
  database
    .prepare("INSERT INTO assets VALUES (?, ?, ?, ?, ?)")
    .run(assetPath, mime, data.byteLength, bytesToHex(sha256(data)), data);
}

export function createRegistryFixture(): PackageFixtureDatabase {
  return createDatabase("registry", CONTENT_REGISTRY_SCHEMA_SQL);
}

export function createUserDataFixture(): PackageFixtureDatabase {
  return createDatabase("user-data", USER_DATA_SCHEMA_SQL);
}

export interface PackageFixtureDatabase {
  readonly database: DatabaseSync;
  readonly file: string;
  readonly reader: StorageSqlReader;
}

function createDatabase(name: string, schema: string): PackageFixtureDatabase {
  const file = path.join(FIXTURE_ROOT, `${name}-${crypto.randomUUID()}.sqlite`);
  const database = new DatabaseSync(file);
  database.exec(schema);
  return { database, file, reader: sqliteReader(database) };
}

function configFor(packageId: PackageId): unknown {
  if (packageId === "duel-core")
    return {
      coreVersion: [11, 0],
      wasmPath: "engine/ocgcore.sync.wasm",
      vendorManifestPath: "engine/vendor-manifest.json",
      strings: {
        system: { "1": "one" },
        victory: { "1": "win" },
        counter: {},
        setname: {},
      },
    };
  if (packageId === "card-library")
    return {
      defaultLocale: "en",
      locales: ["en"],
      revisions: { babelCdb: "fixture", cardScripts: "fixture" },
      requiredScripts: { cards: ["c1.lua"], globals: ["utility.lua"] },
    };
  if (packageId === "freeplay")
    return {
      title: "Free Play",
      defaults: { starterDeckId: "starter", opponentId: "opponent" },
      rulesetId: "fixture",
    };
  return {
    title: "Chapter 1",
    chapterNumber: 1,
    storyContentId: "prototype-prologue-v1",
    defaults: { starterDeckId: "starter", opponentId: "opponent" },
    setIds: ["fixture-set"],
    mapAssetPath: null,
  };
}

function populateOwnedRows(database: DatabaseSync, packageId: PackageId): void {
  if (packageId === "card-library") {
    database.prepare("INSERT INTO cards VALUES (?, ?)").run(
      1,
      JSON.stringify({
        code: 1,
        alias: 0,
        setcodes: [],
        type: 1,
        level: 1,
        attribute: 1,
        race: "1",
        attack: 0,
        defense: 0,
        lscale: 0,
        rscale: 0,
        linkMarker: 0,
        scope: 0,
      }),
    );
    database
      .prepare("INSERT INTO card_texts VALUES (?, ?, ?, ?, ?)")
      .run(1, "en", "Fixture Card", "Fixture text", "[]");
    database
      .prepare("INSERT INTO scripts VALUES (?, ?, ?)")
      .run("c1.lua", "return 1", "0".repeat(64));
    database
      .prepare("INSERT INTO scripts VALUES (?, ?, ?)")
      .run("utility.lua", "return 1", "1".repeat(64));
    database.prepare("INSERT INTO sets VALUES (?, ?)").run(
      "fixture-set",
      JSON.stringify({
        id: "fixture-set",
        name: "Fixture Set",
        releaseYear: 2002,
        imageAssetPath: null,
      }),
    );
    database
      .prepare("INSERT INTO set_cards VALUES (?, ?, ?, ?, ?, ?)")
      .run("fixture-set", 1, "FIX-001", "common", "Common", "C");
    database
      .prepare("INSERT INTO card_search VALUES (?, ?, ?)")
      .run("en", 1, "fixture card");
    return;
  }
  if (packageId === "freeplay" || packageId.startsWith("chapter-")) {
    database
      .prepare("INSERT INTO decks VALUES (?, ?, ?)")
      .run(
        "starter",
        "Starter",
        JSON.stringify({ main: [1], extra: [], side: [] }),
      );
    database
      .prepare("INSERT INTO opponents VALUES (?, ?, ?, ?, ?)")
      .run("opponent", "Opponent", "Ready", "starter", "basic");
  }
  if (packageId === "freeplay")
    database
      .prepare("INSERT INTO freeplay_card_limits VALUES (?, ?)")
      .run(1, 2);
  if (packageId.startsWith("chapter-")) {
    database.prepare("INSERT INTO chapter_card_limits VALUES (?, ?)").run(1, 0);
    database.prepare("INSERT INTO story_documents VALUES (?, ?)").run(
      "prototype-prologue-v1",
      JSON.stringify({
        schemaVersion: 1,
        contentId: "prototype-prologue-v1",
        title: "Fixture",
        beats: [
          {
            id: "fixture-beat",
            speaker: "Rin",
            kind: "dialogue",
            text: "Welcome.",
            background: "station",
            characters: ["rin-neutral"],
          },
        ],
        choices: [
          { id: "trust-rin", label: "Trust" },
          { id: "challenge-rin", label: "Challenge" },
          { id: "observe-first", label: "Observe" },
        ],
        choiceResponses: {
          "trust-rin": "Trust response.",
          "challenge-rin": "Challenge response.",
          "observe-first": "Observe response.",
        },
        laterAcknowledgments: {
          "trust-rin": "Trust acknowledgment.",
          "challenge-rin": "Challenge acknowledgment.",
          "observe-first": "Observe acknowledgment.",
        },
      }),
    );
  }
}
