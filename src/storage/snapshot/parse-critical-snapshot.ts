import { parseCardDefinitions } from "../../cards/index.ts";
import { parseStoryDocument } from "../../story/ports/index.ts";
import type { CriticalSnapshot } from "../contracts/critical-snapshot.ts";
import { parsePackageManifest } from "../schema/package-manifest.ts";
import { validateConfig } from "../schema/package-database.ts";

export class SnapshotFailure extends Error {
  readonly code: string;
  readonly pointer: string;
  readonly received: unknown;
  constructor(code: string, pointer: string, received?: unknown) {
    super(`${code}: ${pointer}`);
    this.code = code;
    this.pointer = pointer;
    this.received = received;
  }
}
function requireValue(
  condition: unknown,
  pointer: string,
  code = "SNAPSHOT_SCHEMA",
): asserts condition {
  if (!condition) throw new SnapshotFailure(code, pointer);
}
function record(
  value: unknown,
  keys: readonly string[],
  pointer: string,
): Record<string, unknown> {
  requireValue(
    value !== null && typeof value === "object" && !Array.isArray(value),
    pointer,
  );
  const r = value as Record<string, unknown>;
  requireValue(
    Object.keys(r).length === keys.length &&
      keys.every((key) => Object.hasOwn(r, key)),
    pointer,
  );
  return r;
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length <= 1_048_576;
}
function id(value: unknown): value is string {
  return text(value) && value.length > 0 && value.length <= 256;
}
function positive(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function rows(
  value: unknown,
  pointer: string,
  key: string,
  cap = 50_000,
): Record<string, unknown>[] {
  requireValue(
    Array.isArray(value) && value.length <= cap,
    pointer,
    "SNAPSHOT_SIZE",
  );
  const ids = new Set<unknown>();
  return value.map((row, index) => {
    requireValue(
      row !== null && typeof row === "object" && !Array.isArray(row),
      `${pointer}/${index}`,
    );
    const r = row as Record<string, unknown>;
    requireValue(
      !ids.has(r[key]),
      `${pointer}/${index}/${key}`,
      "ENTITY_DUPLICATE",
    );
    ids.add(r[key]);
    return r;
  });
}

/** Authoring validation. Authenticated native base loads only need the envelope/bounds. */
export function parseCriticalSnapshot(value: unknown): CriticalSnapshot {
  const r = record(
    value,
    [
      "schemaVersion",
      "compilerVersion",
      "manifest",
      "config",
      "cards",
      "scripts",
      "sets",
      "decks",
      "opponents",
      "limits",
      "stories",
      "media",
    ],
    "",
  );
  requireValue(
    r.schemaVersion === 1 && r.compilerVersion === 1,
    "",
    "SNAPSHOT_SCHEMA",
  );
  const manifest = parsePackageManifest(r.manifest);
  requireValue(manifest.kind === "ok", "/manifest");
  const configForValidation =
    r.config &&
    typeof r.config === "object" &&
    !Array.isArray(r.config) &&
    "mapAssetPath" in r.config
      ? { ...r.config, mapAssetPath: null }
      : r.config;
  requireValue(validateConfig(manifest.value, configForValidation), "/config");
  if (r.config && typeof r.config === "object" && "mapAssetPath" in r.config)
    requireValue(
      r.config.mapAssetPath === null ||
        (text(r.config.mapAssetPath) && r.config.mapAssetPath.length <= 1024),
      "/config/mapAssetPath",
    );
  requireValue(
    Array.isArray(r.cards) && r.cards.length <= 50_000,
    "/cards",
    "SNAPSHOT_SIZE",
  );
  const cardCodes = new Set<number>();
  for (const [index, card] of r.cards.entries()) {
    const p = `/cards/${index}`;
    const c = record(card, ["definition", "texts"], p);
    const d = record(
      c.definition,
      [
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
      ],
      `${p}/definition`,
    );
    requireValue(
      !cardCodes.has(d.code as number),
      `${p}/definition/code`,
      "ENTITY_DUPLICATE",
    );
    cardCodes.add(d.code as number);
    const texts = rows(c.texts, `${p}/texts`, "locale", 64);
    requireValue(texts.length > 0, `${p}/texts`);
    for (const [j, input] of texts.entries()) {
      const t = record(
        input,
        ["locale", "name", "description", "strings"],
        `${p}/texts/${j}`,
      );
      requireValue(
        id(t.locale) &&
          text(t.name) &&
          text(t.description) &&
          Array.isArray(t.strings) &&
          t.strings.length <= 256 &&
          t.strings.every(text),
        `${p}/texts/${j}`,
      );
      try {
        parseCardDefinitions([
          {
            ...d,
            ...t,
            images: {
              full: { code: d.code, variant: "full" },
              cropped: { code: d.code, variant: "cropped" },
            },
          },
        ]);
      } catch {
        throw new SnapshotFailure("CARD_SCHEMA", `${p}/definition`);
      }
    }
  }
  let scriptBytes = 0;
  for (const [i, input] of rows(r.scripts, "/scripts", "name").entries()) {
    const s = record(input, ["name", "source"], `/scripts/${i}`);
    requireValue(
      id(s.name) && /^[A-Za-z0-9_-]+\.lua$/.test(s.name) && text(s.source),
      `/scripts/${i}`,
    );
    scriptBytes += new TextEncoder().encode(s.source).length;
  }
  requireValue(scriptBytes <= 128 * 1024 * 1024, "/scripts", "SNAPSHOT_SIZE");
  for (const [i, input] of rows(r.sets, "/sets", "id", 10_000).entries()) {
    const p = `/sets/${i}`;
    const s = record(
      input,
      ["id", "name", "releaseYear", "imageAssetPath", "cards"],
      p,
    );
    requireValue(
      id(s.id) &&
        text(s.name) &&
        (s.releaseYear === null ||
          (positive(s.releaseYear) && Number(s.releaseYear) <= 9999)) &&
        (s.imageAssetPath === null ||
          (text(s.imageAssetPath) && s.imageAssetPath.length <= 1024)),
      p,
    );
    requireValue(
      Array.isArray(s.cards) && s.cards.length <= 50_000,
      `${p}/cards`,
    );
    const printings = new Set<string>();
    for (const [j, inputCard] of s.cards.entries()) {
      const c = record(
        inputCard,
        [
          "code",
          "name",
          "rarity",
          "printingCode",
          "sourceRarity",
          "sourceRarityCode",
        ],
        `${p}/cards/${j}`,
      );
      requireValue(
        positive(c.code) &&
          [
            c.name,
            c.rarity,
            c.printingCode,
            c.sourceRarity,
            c.sourceRarityCode,
          ].every(text),
        `${p}/cards/${j}`,
      );
      const identity = JSON.stringify([
        c.code,
        c.printingCode,
        c.sourceRarity,
        c.sourceRarityCode,
      ]);
      requireValue(
        !printings.has(identity),
        `${p}/cards/${j}`,
        "ENTITY_DUPLICATE",
      );
      printings.add(identity);
    }
  }
  const decks = rows(r.decks, "/decks", "id", 10_000);
  for (const [i, input] of decks.entries()) {
    const d = record(
      input,
      ["id", "name", "main", "extra", "side"],
      `/decks/${i}`,
    );
    requireValue(id(d.id) && text(d.name), `/decks/${i}`);
    for (const zone of ["main", "extra", "side"])
      requireValue(
        Array.isArray(d[zone]) &&
          (d[zone] as unknown[]).length <= 1000 &&
          (d[zone] as unknown[]).every(positive),
        `/decks/${i}/${zone}`,
      );
  }
  for (const [i, input] of rows(
    r.opponents,
    "/opponents",
    "id",
    10_000,
  ).entries()) {
    const o = record(
      input,
      ["id", "name", "line", "deckId", "policyId"],
      `/opponents/${i}`,
    );
    requireValue(
      id(o.id) && text(o.name) && text(o.line) && o.policyId === "basic",
      `/opponents/${i}`,
    );
    requireValue(
      decks.some((d) => d.id === o.deckId),
      `/opponents/${i}/deckId`,
      "REFERENCE_MISSING",
    );
  }
  requireValue(Array.isArray(r.limits) && r.limits.length <= 50_000, "/limits");
  const limits = new Set<unknown>();
  for (const [i, row] of r.limits.entries()) {
    requireValue(
      Array.isArray(row) &&
        row.length === 2 &&
        positive(row[0]) &&
        [0, 1, 2].includes(row[1]),
      `/limits/${i}`,
    );
    requireValue(!limits.has(row[0]), `/limits/${i}`, "ENTITY_DUPLICATE");
    limits.add(row[0]);
  }
  for (const [i, story] of rows(
    r.stories,
    "/stories",
    "contentId",
    10_000,
  ).entries()) {
    try {
      parseStoryDocument(story);
    } catch (error) {
      const pointer =
        error &&
        typeof error === "object" &&
        "pointer" in error &&
        typeof error.pointer === "string"
          ? error.pointer
          : "";
      throw new SnapshotFailure("STORY_SCHEMA", `/stories/${i}${pointer}`);
    }
  }
  for (const [i, input] of rows(r.media, "/media", "id", 100_000).entries()) {
    const m = record(input, ["id", "path", "mime"], `/media/${i}`);
    requireValue(
      id(m.id) || (text(m.id) && m.id.length <= 1024),
      `/media/${i}/id`,
    );
    requireValue(
      text(m.path) && m.path.length <= 1024,
      `/media/${i}/path`,
      "MEDIA_PATH",
    );
    requireValue(id(m.mime), `/media/${i}/mime`);
  }
  return value as CriticalSnapshot;
}
