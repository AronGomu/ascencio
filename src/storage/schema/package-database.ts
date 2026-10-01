import { validateCommerce } from "../../modules/index.ts";
import { isChapterModule } from "../../modules/index.ts";
import { packageDatabaseFailure } from "./package-database-failure.ts";
import { parseStoryDocument } from "../../story/ports/index.ts";
import type { PackageManifest, StorageResult } from "../contracts/package.ts";
import type { PackageConfig } from "../contracts/package-payloads.ts";
import { parsePackageManifest } from "./package-manifest.ts";
import {
  PACKAGE_SCHEMA_SQL,
  CARD_LIBRARY_SCHEMA_SQL,
  FREEPLAY_SCHEMA_SQL,
  CHAPTER_SCHEMA_SQL,
} from "./sql.ts";

export type SqliteValue = string | number | bigint | Uint8Array | null;
export interface StorageSqlReader {
  /** Local adapter only; supports fixed connection PRAGMAs, never exposed by RPC. */
  all(
    sql: string,
    parameters?: readonly SqliteValue[],
  ): readonly Readonly<Record<string, SqliteValue>>[];
}
export interface ValidatedPackageHeader {
  readonly manifest: PackageManifest;
  readonly config: PackageConfig;
}
export interface ValidatedPackageDatabase extends ValidatedPackageHeader {
  readonly assetCount: number;
}

type ColumnSpec = readonly [
  name: string,
  type: "TEXT" | "INTEGER" | "BLOB",
  notNull: 0 | 1,
  primaryKey: number,
];
const COMMON_TABLES = {
  package_manifest: [
    ["package_id", "TEXT", 0, 1],
    ["package_type", "TEXT", 1, 0],
    ["version", "TEXT", 1, 0],
    ["schema_version", "INTEGER", 1, 0],
    ["dependencies_json", "TEXT", 1, 0],
    ["created_at", "TEXT", 1, 0],
  ],
  package_meta: [
    ["key", "TEXT", 0, 1],
    ["value_json", "TEXT", 1, 0],
  ],
  assets: [
    ["path", "TEXT", 0, 1],
    ["mime", "TEXT", 1, 0],
    ["byte_length", "INTEGER", 1, 0],
    ["sha256", "TEXT", 1, 0],
    ["data", "BLOB", 1, 0],
  ],
} as const satisfies Readonly<Record<string, readonly ColumnSpec[]>>;
const CARD_LIBRARY_TABLES = {
  cards: [
    ["code", "INTEGER", 0, 1],
    ["definition_json", "TEXT", 1, 0],
  ],
  card_texts: [
    ["card_code", "INTEGER", 1, 1],
    ["locale", "TEXT", 1, 2],
    ["name", "TEXT", 1, 0],
    ["description", "TEXT", 1, 0],
    ["strings_json", "TEXT", 1, 0],
  ],
  scripts: [
    ["name", "TEXT", 0, 1],
    ["source", "TEXT", 1, 0],
    ["sha256", "TEXT", 1, 0],
  ],
  sets: [
    ["id", "TEXT", 0, 1],
    ["metadata_json", "TEXT", 1, 0],
  ],
  set_cards: [
    ["set_id", "TEXT", 1, 1],
    ["card_code", "INTEGER", 1, 2],
    ["printing_code", "TEXT", 1, 3],
    ["rarity", "TEXT", 1, 0],
    ["source_rarity", "TEXT", 1, 4],
    ["source_rarity_code", "TEXT", 1, 5],
  ],
  card_search: [
    ["locale", "TEXT", 1, 1],
    ["card_code", "INTEGER", 1, 2],
    ["normalized_name", "TEXT", 1, 0],
  ],
} as const satisfies Readonly<Record<string, readonly ColumnSpec[]>>;
const PLAY_TABLES = {
  decks: [
    ["id", "TEXT", 0, 1],
    ["name", "TEXT", 1, 0],
    ["cards_json", "TEXT", 1, 0],
  ],
  opponents: [
    ["id", "TEXT", 0, 1],
    ["name", "TEXT", 1, 0],
    ["line", "TEXT", 1, 0],
    ["deck_id", "TEXT", 1, 0],
    ["policy_id", "TEXT", 1, 0],
  ],
} as const satisfies Readonly<Record<string, readonly ColumnSpec[]>>;
const FREEPLAY_TABLES = {
  ...PLAY_TABLES,
  freeplay_card_limits: [
    ["card_code", "INTEGER", 0, 1],
    ["deck_limit", "INTEGER", 1, 0],
  ],
} as const satisfies Readonly<Record<string, readonly ColumnSpec[]>>;
const CHAPTER_TABLES = {
  ...PLAY_TABLES,
  chapter_card_limits: [
    ["card_code", "INTEGER", 0, 1],
    ["deck_limit", "INTEGER", 1, 0],
  ],
  story_documents: [
    ["id", "TEXT", 0, 1],
    ["payload_json", "TEXT", 1, 0],
  ],
} as const satisfies Readonly<Record<string, readonly ColumnSpec[]>>;

export function validatePackageDatabaseHeader(
  database: StorageSqlReader,
): StorageResult<ValidatedPackageHeader> {
  try {
    database.all("PRAGMA trusted_schema=OFF");
    if (scalarNumber(database, "PRAGMA trusted_schema", "trusted_schema") !== 0)
      return invalid();
    const userVersion = scalarNumber(
      database,
      "PRAGMA user_version",
      "user_version",
    );
    if (userVersion !== 1)
      return { kind: "failed", error: { code: "PACKAGE_SCHEMA_UNSUPPORTED" } };
    if (
      scalarString(database, "PRAGMA journal_mode", "journal_mode") !==
        "delete" ||
      scalarString(database, "PRAGMA encoding", "encoding") !== "UTF-8" ||
      !validPageSize(scalarNumber(database, "PRAGMA page_size", "page_size"))
    )
      return invalid();
    // Only engine schema metadata is read until every object matches pinned DDL.
    const schemaType = validateSchema(database);
    if (schemaType === null) return invalid();
    const manifestRows = database.all(
      "SELECT package_id, package_type, version, schema_version, dependencies_json, created_at FROM package_manifest ORDER BY package_id",
    );
    if (manifestRows.length !== 1) return invalid();
    const row = manifestRows[0]!;
    const dependencies = parseJson(row.dependencies_json);
    if (dependencies === null) return invalid();
    const parsedManifest = parsePackageManifest({
      packageId: row.package_id,
      packageType: row.package_type,
      version: row.version,
      schemaVersion: row.schema_version,
      dependencies,
      createdAt: row.created_at,
    });
    if (parsedManifest.kind === "failed") return parsedManifest;
    if (parsedManifest.value.packageType !== schemaType) return invalid();
    const metaRows = database.all(
      "SELECT key, value_json FROM package_meta ORDER BY key",
    );
    if (metaRows.length !== 1 || metaRows[0]?.key !== "config")
      return invalid();
    const config = parseJson(metaRows[0].value_json);
    if (!validateConfig(parsedManifest.value, config)) return invalid();
    return {
      kind: "ok",
      value: Object.freeze({
        manifest: parsedManifest.value,
        config: config as PackageConfig,
      }),
    };
  } catch (error) {
    console.error("SQLite package header validation threw", error);
    return packageDatabaseFailure(error);
  }
}

export function validatePackageDatabase(
  database: StorageSqlReader,
): StorageResult<ValidatedPackageDatabase> {
  const header = validatePackageDatabaseHeader(database);
  if (header.kind === "failed") return header;
  try {
    const integrity = database.all("PRAGMA integrity_check");
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") {
      console.error("SQLite package integrity_check failed", integrity);
      return { kind: "failed", error: { code: "PACKAGE_INTEGRITY_FAILED" } };
    }
    const foreignKeys = database.all("PRAGMA foreign_key_check");
    if (foreignKeys.length !== 0) {
      console.error("SQLite package foreign_key_check failed", foreignKeys);
      return { kind: "failed", error: { code: "PACKAGE_INTEGRITY_FAILED" } };
    }
    if (
      !validateAssets(database, header.value.manifest) ||
      !validateOwnedRows(database, header.value.manifest)
    )
      return invalid();
    const assetCount = scalarNumber(
      database,
      "SELECT count(*) AS count FROM assets",
      "count",
    );
    return {
      kind: "ok",
      value: Object.freeze({ ...header.value, assetCount }),
    };
  } catch (error) {
    return packageDatabaseFailure(error, header.value.manifest.packageId);
  }
}

function tablesFor(
  packageType: PackageManifest["packageType"],
): Readonly<Record<string, readonly ColumnSpec[]>> {
  if (packageType === "card-library")
    return { ...COMMON_TABLES, ...CARD_LIBRARY_TABLES };
  if (packageType === "freeplay")
    return { ...COMMON_TABLES, ...FREEPLAY_TABLES };
  if (packageType === "chapter") return { ...COMMON_TABLES, ...CHAPTER_TABLES };
  return COMMON_TABLES;
}

const OWNED_SCHEMA_SQL = {
  "duel-core": "",
  "card-library": CARD_LIBRARY_SCHEMA_SQL,
  freeplay: FREEPLAY_SCHEMA_SQL,
  chapter: CHAPTER_SCHEMA_SQL,
} as const;

function hasPrimaryIndex(columns: readonly ColumnSpec[]): boolean {
  const keys = columns.filter((column) => column[3] > 0);
  return keys.length > 0 && !(keys.length === 1 && keys[0]![1] === "INTEGER");
}

function validateSchema(
  database: StorageSqlReader,
): PackageManifest["packageType"] | null {
  const objects = database.all(
    "SELECT type, name, tbl_name, sql FROM main.sqlite_schema ORDER BY type, name",
  );
  for (const packageType of Object.keys(
    OWNED_SCHEMA_SQL,
  ) as PackageManifest["packageType"][]) {
    const tables = tablesFor(packageType);
    // Split only trusted source constants, never package-authored SQL. SQLite
    // stores these CREATE statements without their terminal semicolons. Exact
    // text rejects comments, extra expressions and alternate DDL spellings.
    const definitions = (PACKAGE_SCHEMA_SQL + OWNED_SCHEMA_SQL[packageType])
      .split(";")
      .map((sql) => sql.trim())
      .filter((sql) => sql.startsWith("CREATE "));
    const expected = new Map<
      string,
      { type: string; table: string; sql: string | null }
    >();
    for (const sql of definitions) {
      const [, type, name] = /^CREATE (TABLE|INDEX) ([a-z_]+)/.exec(sql)!;
      expected.set(name!, {
        type: type!.toLowerCase(),
        table: type === "TABLE" ? name! : "card_search",
        sql,
      });
    }
    for (const [table, columns] of Object.entries(tables)) {
      if (hasPrimaryIndex(columns))
        expected.set(`sqlite_autoindex_${table}_1`, {
          type: "index",
          table,
          sql: null,
        });
    }
    if (
      objects.length !== expected.size ||
      !objects.every((row) => {
        const definition =
          typeof row.name === "string" ? expected.get(row.name) : undefined;
        return (
          definition !== undefined &&
          row.type === definition.type &&
          row.tbl_name === definition.table &&
          row.sql === definition.sql
        );
      })
    )
      continue;

    for (const [table, expectedColumns] of Object.entries(tables)) {
      const actualColumns = database.all(`PRAGMA table_xinfo("${table}")`);
      if (actualColumns.length !== expectedColumns.length) return null;
      for (let index = 0; index < expectedColumns.length; index += 1) {
        const actual = actualColumns[index]!;
        const expected = expectedColumns[index]!;
        if (
          actual.cid !== index ||
          actual.name !== expected[0] ||
          actual.type !== expected[1] ||
          actual.notnull !== expected[2] ||
          actual.pk !== expected[3] ||
          actual.hidden !== 0 ||
          actual.dflt_value !== null
        )
          return null;
      }
      if (!validateTableIndexes(database, table, expectedColumns)) return null;
    }
    return validateForeignKeys(database, packageType) ? packageType : null;
  }
  return null;
}

function validateConfig(manifest: PackageManifest, value: unknown): boolean {
  if (!plainRecord(value)) return false;
  if (manifest.packageType === "duel-core")
    return (
      exactKeys(value, [
        "coreVersion",
        "wasmPath",
        "vendorManifestPath",
        "strings",
      ]) &&
      tupleEquals(value.coreVersion, [11, 0]) &&
      value.wasmPath === "engine/ocgcore.sync.wasm" &&
      value.vendorManifestPath === "engine/vendor-manifest.json" &&
      stringGroups(value.strings)
    );
  if (manifest.packageType === "card-library")
    return (
      exactKeys(value, [
        "defaultLocale",
        "locales",
        "revisions",
        "requiredScripts",
        ...(Object.hasOwn(value, "commerce") ? ["commerce"] : []),
      ]) &&
      value.defaultLocale === "en" &&
      stringArray(value.locales, false, true) &&
      exactStringRecord(value.revisions, ["babelCdb", "cardScripts"]) &&
      requiredScripts(value.requiredScripts) &&
      (value.commerce === undefined ||
        validateCommerce(value.commerce, undefined, false))
    );
  if (manifest.packageType === "freeplay")
    return (
      exactKeys(value, ["title", "defaults", "rulesetId"]) &&
      nonempty(value.title) &&
      defaults(value.defaults) &&
      nonempty(value.rulesetId)
    );
  const chapter = Number(manifest.packageId.slice(8));
  return (
    exactKeys(value, [
      "title",
      "chapterNumber",
      "storyContentId",
      "defaults",
      "setIds",
      "mapAssetPath",
      ...(Object.hasOwn(value, "module") ? ["module"] : []),
      ...(Object.hasOwn(value, "shopId") ? ["shopId"] : []),
    ]) &&
    nonempty(value.title) &&
    value.chapterNumber === chapter &&
    (value.storyContentId === null ||
      (nonempty(value.storyContentId) &&
        String(value.storyContentId).length <= 256)) &&
    (value.module === undefined || isChapterModule(value.module)) &&
    defaults(value.defaults) &&
    (value.shopId === undefined || nonempty(value.shopId)) &&
    stringArray(value.setIds, true, true) &&
    (value.mapAssetPath === null || validAssetPath(value.mapAssetPath))
  );
}

function validateTableIndexes(
  database: StorageSqlReader,
  table: string,
  columns: readonly ColumnSpec[],
): boolean {
  const indexes = database.all(`PRAGMA index_list("${table}")`);
  const primaryColumns = columns
    .filter((column) => column[3] > 0)
    .sort((a, b) => a[3] - b[3])
    .map((column) => column[0]);
  const expected = [
    ...(hasPrimaryIndex(columns)
      ? [
          {
            name: `sqlite_autoindex_${table}_1`,
            origin: "pk",
            unique: 1,
            columns: primaryColumns,
          },
        ]
      : []),
    ...(table === "card_search"
      ? [
          {
            name: "card_search_name",
            origin: "c",
            unique: 0,
            columns: ["locale", "normalized_name", "card_code"],
          },
        ]
      : []),
  ];
  if (indexes.length !== expected.length) return false;
  return expected.every((definition) => {
    const index = indexes.find((row) => row.name === definition.name);
    if (
      !index ||
      index.origin !== definition.origin ||
      index.unique !== definition.unique ||
      index.partial !== 0
    )
      return false;
    const keys = database
      .all(`PRAGMA index_xinfo("${definition.name}")`)
      .filter((row) => row.key === 1);
    return (
      keys.length === definition.columns.length &&
      keys.every(
        (key, position) =>
          key.seqno === position &&
          key.name === definition.columns[position] &&
          key.cid === columns.findIndex((column) => column[0] === key.name) &&
          key.desc === 0 &&
          key.coll === "BINARY",
      )
    );
  });
}

function validateForeignKeys(
  database: StorageSqlReader,
  packageType: PackageManifest["packageType"],
): boolean {
  const expected: Readonly<Record<string, readonly string[]>> =
    packageType === "card-library"
      ? {
          card_texts: ["cards:card_code:code"],
          set_cards: ["cards:card_code:code", "sets:set_id:id"],
          card_search: ["cards:card_code:code"],
        }
      : packageType === "freeplay" || packageType === "chapter"
        ? { opponents: ["decks:deck_id:id"] }
        : {};
  for (const table of Object.keys(tablesFor(packageType))) {
    const rows = database.all(`PRAGMA foreign_key_list("${table}")`);
    if (
      rows.some(
        (row) =>
          row.seq !== 0 ||
          row.on_update !== "NO ACTION" ||
          row.on_delete !== "NO ACTION" ||
          row.match !== "NONE",
      )
    )
      return false;
    const actual = rows
      .map((row) => `${row.table}:${row.from}:${row.to}`)
      .sort();
    if (actual.join("\n") !== [...(expected[table] ?? [])].sort().join("\n"))
      return false;
  }
  return true;
}

function validateAssets(
  database: StorageSqlReader,
  manifest: PackageManifest,
): boolean {
  const rows = database.all(
    "SELECT path, mime, byte_length, sha256, length(data) AS actual_length FROM assets ORDER BY path",
  );
  const folded = new Set<string>();
  for (const row of rows) {
    if (
      !validAssetPath(row.path) ||
      !ownedAssetPath(manifest, row.path) ||
      !nonempty(row.mime) ||
      !safeNonnegative(row.byte_length) ||
      typeof row.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.sha256) ||
      row.actual_length !== row.byte_length
    )
      return false;
    const normalized = (row.path as string)
      .normalize("NFC")
      .toLocaleLowerCase("en-US");
    if (folded.has(normalized)) return false;
    folded.add(normalized);
  }
  return true;
}

export function ownedAssetPath(
  manifest: PackageManifest,
  path: SqliteValue,
): boolean {
  if (typeof path !== "string") return false;
  if (manifest.packageType === "duel-core")
    return ["engine/ocgcore.sync.wasm", "engine/vendor-manifest.json"].includes(
      path,
    );
  if (manifest.packageType === "freeplay") return false;
  if (manifest.packageType === "chapter") return path.startsWith("media/");
  return (
    path === "card-back.jpg" ||
    /^cards\/(?:full|cropped)\/[1-9][0-9]*\.jpg$/.test(path) ||
    /^sets\/[^/]+\.[A-Za-z0-9]+$/.test(path)
  );
}

function validateOwnedRows(
  database: StorageSqlReader,
  manifest: PackageManifest,
): boolean {
  if (manifest.packageType === "card-library") {
    for (const row of database.all(
      "SELECT code, definition_json FROM cards ORDER BY code",
    )) {
      const value = parseJson(row.definition_json);
      if (!cardRow(value) || !plainRecord(value) || value.code !== row.code)
        return false;
    }
    for (const row of database.all(
      "SELECT strings_json FROM card_texts ORDER BY card_code, locale",
    ))
      if (!stringArray(parseJson(row.strings_json), true, false)) return false;
    for (const row of database.all("SELECT sha256 FROM scripts ORDER BY name"))
      if (typeof row.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sha256))
        return false;
    for (const row of database.all(
      "SELECT id, metadata_json FROM sets ORDER BY id",
    )) {
      const value = parseJson(row.metadata_json);
      if (!setRow(value) || !plainRecord(value) || value.id !== row.id)
        return false;
    }
  }
  if (
    manifest.packageType === "freeplay" ||
    manifest.packageType === "chapter"
  ) {
    for (const row of database.all("SELECT cards_json FROM decks ORDER BY id"))
      if (!deckRow(parseJson(row.cards_json))) return false;
    for (const row of database.all(
      "SELECT policy_id FROM opponents ORDER BY id",
    ))
      if (row.policy_id !== "basic") return false;
  }
  if (manifest.packageType === "chapter")
    for (const row of database.all(
      "SELECT id, payload_json FROM story_documents ORDER BY id",
    )) {
      try {
        if (
          parseStoryDocument(parseJson(row.payload_json)).contentId !== row.id
        )
          return false;
      } catch {
        return false;
      }
    }
  return true;
}

function cardRow(value: unknown): boolean {
  if (
    !plainRecord(value) ||
    !exactKeys(value, [
      "code",
      "alias",
      "setcodes",
      "type",
      "level",
      "attribute",
      "race",
      "attack",
      "defense",
      "lscale",
      "rscale",
      "linkMarker",
      "scope",
    ])
  )
    return false;
  return (
    positive(value.code) &&
    safeNonnegative(value.alias) &&
    Array.isArray(value.setcodes) &&
    value.setcodes.every(safeNonnegative) &&
    [
      "type",
      "level",
      "attribute",
      "lscale",
      "rscale",
      "linkMarker",
      "scope",
    ].every((key) => safeNonnegative(value[key])) &&
    Number.isSafeInteger(value.attack) &&
    Number.isSafeInteger(value.defense) &&
    typeof value.race === "string" &&
    /^(?:0|[1-9][0-9]*)$/.test(value.race)
  );
}
function setRow(value: unknown): boolean {
  return (
    plainRecord(value) &&
    exactKeys(value, ["id", "name", "releaseYear", "imageAssetPath"]) &&
    nonempty(value.id) &&
    nonempty(value.name) &&
    (value.releaseYear === null ||
      (positive(value.releaseYear) && value.releaseYear <= 9999)) &&
    (value.imageAssetPath === null || validAssetPath(value.imageAssetPath))
  );
}
function deckRow(value: unknown): boolean {
  return (
    plainRecord(value) &&
    exactKeys(value, ["main", "extra", "side"]) &&
    [value.main, value.extra, value.side].every(
      (cards) => Array.isArray(cards) && dense(cards) && cards.every(positive),
    )
  );
}
function scalarNumber(
  database: StorageSqlReader,
  sql: string,
  column: string,
): number {
  const rows = database.all(sql);
  const value = rows.length === 1 ? rows[0]?.[column] : null;
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new Error("invalid scalar");
  return value;
}
function scalarString(
  database: StorageSqlReader,
  sql: string,
  column: string,
): string {
  const rows = database.all(sql);
  const value = rows.length === 1 ? rows[0]?.[column] : null;
  if (typeof value !== "string") throw new Error("invalid scalar");
  return value;
}
function parseJson(value: SqliteValue | undefined): unknown | null {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
function validPageSize(value: number): boolean {
  return value >= 512 && value <= 65_536 && (value & (value - 1)) === 0;
}
function plainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const own = Object.keys(value).sort();
  return (
    own.length === keys.length &&
    own.every((key, index) => key === [...keys].sort()[index])
  );
}
function dense(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, index)) return false;
  return true;
}
function nonempty(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 65_536
  );
}
function safeNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function positive(value: unknown): value is number {
  return safeNonnegative(value) && value > 0;
}
function tupleEquals(value: unknown, expected: readonly number[]): boolean {
  return (
    Array.isArray(value) &&
    dense(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}
function stringArray(
  value: unknown,
  allowEmpty: boolean,
  unique: boolean,
): value is string[] {
  return (
    Array.isArray(value) &&
    dense(value) &&
    value.every(
      (item) => typeof item === "string" && (allowEmpty || item.length > 0),
    ) &&
    (!unique || new Set(value).size === value.length)
  );
}
function exactStringRecord(value: unknown, keys: readonly string[]): boolean {
  return (
    plainRecord(value) &&
    exactKeys(value, keys) &&
    keys.every((key) => nonempty(value[key]))
  );
}
function stringGroups(value: unknown): boolean {
  if (
    !plainRecord(value) ||
    !exactKeys(value, ["system", "victory", "counter", "setname"])
  )
    return false;
  return [value.system, value.victory, value.counter, value.setname].every(
    (group) =>
      plainRecord(group) &&
      Object.values(group).every((entry) => typeof entry === "string"),
  );
}
function requiredScripts(value: unknown): boolean {
  return (
    plainRecord(value) &&
    exactKeys(value, ["cards", "globals"]) &&
    stringArray(value.cards, false, true) &&
    stringArray(value.globals, false, true)
  );
}
function defaults(value: unknown): boolean {
  return (
    plainRecord(value) &&
    exactKeys(value, ["starterDeckId", "opponentId"]) &&
    nonempty(value.starterDeckId) &&
    nonempty(value.opponentId)
  );
}
export function validAssetPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1024 ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.startsWith("/") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
  )
    return false;
  const segments = value.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}
function invalid(): StorageResult<never> {
  return { kind: "failed", error: { code: "PACKAGE_INVALID" } };
}
