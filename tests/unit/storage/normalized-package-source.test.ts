import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { commerceFixture } from "../../fixtures/commerce.ts";
import { exportPackages } from "../../../scripts/lib/sqlite-content/export-packages.ts";

const roots: string[] = [];
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
async function fixture() {
  await mkdir(".tmp/manual-sqlite-t2-global", { recursive: true });
  const root = await mkdtemp(
    path.resolve(".tmp/manual-sqlite-t2-global/normalized-package-"),
  );
  roots.push(root);
  await cp("tests/fixtures/sqlite", path.join(root, "tests/fixtures/sqlite"), {
    recursive: true,
  });
  const spec = JSON.parse(
    await readFile("tests/fixtures/sqlite/packages.json", "utf8"),
  );
  for (const id of ["card-library", "chapter-01"]) {
    await cp(
      `tests/fixtures/sqlite/sources/${id}`,
      path.join(root, `assets/content/${id}`),
      { recursive: true },
    );
    spec.packages.find(
      (entry: { manifest: { packageId: string } }) =>
        entry.manifest.packageId === id,
    ).sourceRoot = `assets/content/${id}`;
  }
  const library = "assets/content/card-library";
  const chapter = "assets/content/chapter-01";
  const json = async (file: string, value: unknown) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), JSON.stringify(value));
  };
  const cards = JSON.parse(
    await readFile(path.join(root, library, "cards.json"), "utf8"),
  );
  await json(
    `${library}/data/catalog/cards/00.json`,
    cards.map(({ scope, ...card }: { scope: number }) => ({
      ...card,
      ot: scope,
      category: 0,
    })),
  );
  const texts = JSON.parse(
    await readFile(path.join(root, library, "card-texts.json"), "utf8"),
  );
  await json(
    `${library}/data/catalog/texts/en/00.json`,
    texts.map(
      ({
        cardCode,
        name,
        description,
        strings,
      }: {
        cardCode: number;
        name: string;
        description: string;
        strings: string[];
      }) => ({ code: cardCode, name, description, strings }),
    ),
  );
  await json(`${library}/data/scripts/cards/00.json`, {
    "c1.lua": "-- required",
    "c2.lua": "-- outside chapter",
  });
  await json(`${library}/data/scripts/globals.json`, {
    "utility.lua": "-- required global",
    "extra.lua": "-- sourced global",
  });
  await json(`${library}/data/scripts/index.json`, {
    official: ["c1.lua"],
    preRelease: ["c2.lua"],
    globals: ["extra.lua", "utility.lua"],
    shardCount: 1,
    algorithm: "code-modulo",
  });
  for (const file of [
    "cards.json",
    "card-texts.json",
    "assets.json",
    "scripts",
  ]) {
    await rm(path.join(root, library, file), { recursive: true });
  }
  await rm(path.join(root, chapter, "limits.json"));
  for (const [id, name, year, code, rarity, sourceRarity, sourceRarityCode] of [
    ["fixture-set", "Fixture Set", 2002, 1, "common", "Common", "C"],
    ["future-set", "Future Set", 2026, 2, "rare", "Rare", "R"],
  ] as const) {
    await json(`${library}/sets/${id}.json`, {
      id,
      name,
      releaseYear: year,
      imageAssetPath: `sets/${id}.jpg`,
      cards: [
        {
          cardCode: code,
          printingCode: code === 1 ? "FIX-001" : "FUT-001",
          rarity,
          sourceRarity,
          sourceRarityCode,
        },
      ],
    });
  }
  const commerce = commerceFixture();
  commerce.boosters[0]!.setId = "fixture-set";
  for (const kind of ["economies", "boosters", "shops"] as const)
    for (const entity of commerce[kind])
      await json(`content/commerce/${kind}/${entity.id}.json`, entity);
  await json("content/commerce/sources.json", {
    schemaVersion: 1,
    baseVersion: "1.0.0",
    sets: [`${library}/sets`],
    economies: ["content/commerce/economies"],
    boosters: ["content/commerce/boosters"],
    shops: ["content/commerce/shops"],
    mods: [],
  });
  Object.assign(spec.packages[1], {
    sourceManifest: "content/commerce/sources.json",
    sourceVersion: "1.0.0",
  });
  await json("content/commerce/chapters/chapter-01.json", {
    shopId: "shop",
    allowedCardCodes: [1],
  });
  await rm(path.join(root, library, "sets.json"));
  await rm(path.join(root, library, "set-cards.json"));
  for (const file of [
    "images/full/1.jpg",
    "images/cropped/1.jpg",
    "images/sets/fixture-set.jpg",
    "images/sets/future-set.jpg",
    "images/card-back.jpg",
  ]) {
    await mkdir(path.dirname(path.join(root, library, file)), {
      recursive: true,
    });
    await writeFile(
      path.join(root, library, file),
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    );
  }
  await mkdir(path.join(root, chapter, "media"), { recursive: true });
  await writeFile(
    path.join(root, chapter, "media/map.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  return { root, spec, json, library, chapter };
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true });
});

it("exports normalized global catalog/scripts/media; derives independent chapter exclusions", async () => {
  const { root, spec } = await fixture();
  const result = await exportPackages(root, spec);
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") return;
  const library = new DatabaseSync(
    path.join(root, "generated/content-packages/card-library-1.0.0.sqlite"),
    { readOnly: true },
  );
  try {
    expect(
      library.prepare("SELECT code FROM cards ORDER BY code").all(),
    ).toEqual([{ code: 1 }, { code: 2 }]);
    const definition = JSON.parse(
      String(
        library.prepare("SELECT definition_json FROM cards WHERE code=2").get()!
          .definition_json,
      ),
    );
    expect(definition).toHaveProperty("scope");
    expect(definition).not.toHaveProperty("ot");
    expect(definition).not.toHaveProperty("category");
    expect(
      library
        .prepare("SELECT name, source, sha256 FROM scripts ORDER BY name")
        .all(),
    ).toEqual([
      { name: "c1.lua", source: "-- required", sha256: digest("-- required") },
      {
        name: "c2.lua",
        source: "-- outside chapter",
        sha256: digest("-- outside chapter"),
      },
      {
        name: "extra.lua",
        source: "-- sourced global",
        sha256: digest("-- sourced global"),
      },
      {
        name: "utility.lua",
        source: "-- required global",
        sha256: digest("-- required global"),
      },
    ]);
    expect(
      library.prepare("SELECT path FROM assets ORDER BY path").all(),
    ).toEqual(
      [
        "card-back.jpg",
        "cards/cropped/1.jpg",
        "cards/full/1.jpg",
        "sets/fixture-set.jpg",
        "sets/future-set.jpg",
      ].map((path) => ({ path })),
    );
    expect(
      library.prepare("SELECT count(*) AS count FROM set_cards").get()!.count,
    ).toBe(2);
    expect(library.prepare("SELECT id FROM sets ORDER BY id").all()).toEqual([
      { id: "fixture-set" },
      { id: "future-set" },
    ]);
  } finally {
    library.close();
  }
  const chapter = new DatabaseSync(
    path.join(root, "generated/content-packages/chapter-01-1.0.0.sqlite"),
    { readOnly: true },
  );
  try {
    expect(
      chapter
        .prepare(
          "SELECT card_code, deck_limit FROM chapter_card_limits ORDER BY card_code",
        )
        .all(),
    ).toEqual([{ card_code: 2, deck_limit: 0 }]);
    expect(chapter.prepare("SELECT path FROM assets").all()).toEqual([
      { path: "media/map.svg" },
    ]);
  } finally {
    chapter.close();
  }
  expect(
    result.value.find((row) => row.packageId === "card-library")!
      .missingOptionalMedia,
  ).toEqual(["cards/cropped/2.jpg", "cards/full/2.jpg"]);
  expect(await exportPackages(root, spec)).toEqual(result);
});

it("keeps included authored chapter limits independent from Freeplay", async () => {
  const { root, spec, json, chapter } = await fixture();
  await json(`${chapter}/limits.json`, [{ cardCode: 1, deckLimit: 1 }]);
  const result = await exportPackages(root, spec);
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") return;
  const db = new DatabaseSync(
    path.join(root, "generated/content-packages/chapter-01-1.0.0.sqlite"),
    { readOnly: true },
  );
  try {
    expect(
      db
        .prepare(
          "SELECT card_code, deck_limit FROM chapter_card_limits ORDER BY card_code",
        )
        .all(),
    ).toEqual([
      { card_code: 1, deck_limit: 1 },
      { card_code: 2, deck_limit: 0 },
    ]);
  } finally {
    db.close();
  }
});

it("rejects malformed canonical printings before any output", async () => {
  const { root, spec, library, json } = await fixture();
  const file = `${library}/sets/fixture-set.json`;
  const source = JSON.parse(await readFile(path.join(root, file), "utf8"));
  source.cards[0].sourceRarityCode = null;
  await json(file, source);
  await expect(exportPackages(root, spec)).rejects.toMatchObject({
    code: "SOURCE_ENTITY_INVALID",
    source: file,
  });
  await expect(
    readdir(path.join(root, "generated/content-packages")),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects incomplete indexed scripts instead of silently dropping sourced input", async () => {
  const { root, spec, json, library } = await fixture();
  await json(`${library}/data/scripts/cards/00.json`, {
    "c1.lua": "-- required",
  });
  expect(await exportPackages(root, spec)).toEqual({
    kind: "failed",
    error: {
      code: "PACKAGE_SOURCE_INCOMPLETE",
      packageId: "card-library",
      path: "data/scripts/index.json",
    },
  });
});

it("retains undated sets and every printing variant without rewriting canonical input", async () => {
  const { root, spec, library, json } = await fixture();
  const file = `${library}/sets/future-set.json`;
  const source = JSON.parse(await readFile(path.join(root, file), "utf8"));
  source.releaseYear = null;
  source.cards.push(
    {
      ...source.cards[0],
      rarity: "common",
      sourceRarity: "Short Print",
      sourceRarityCode: "SP",
    },
    { ...source.cards[0], sourceRarityCode: "" },
  );
  await json(file, source);
  const before = await readFile(path.join(root, file));
  const result = await exportPackages(root, spec);
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") throw new Error(JSON.stringify(result));
  const receipt = result.value.find((row) => row.packageId === "card-library")!;
  const db = new DatabaseSync(path.join(root, receipt.path), {
    readOnly: true,
  });
  try {
    expect(
      JSON.parse(
        String(
          db
            .prepare("SELECT metadata_json FROM sets WHERE id='future-set'")
            .get()!.metadata_json,
        ),
      ),
    ).toMatchObject({ id: "future-set", releaseYear: null });
    expect(
      db
        .prepare(
          "SELECT printing_code, source_rarity, source_rarity_code FROM set_cards WHERE card_code=2 ORDER BY source_rarity, source_rarity_code",
        )
        .all(),
    ).toEqual([
      {
        printing_code: "FUT-001",
        source_rarity: "Rare",
        source_rarity_code: "",
      },
      {
        printing_code: "FUT-001",
        source_rarity: "Rare",
        source_rarity_code: "R",
      },
      {
        printing_code: "FUT-001",
        source_rarity: "Short Print",
        source_rarity_code: "SP",
      },
    ]);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    db.close();
  }
  expect(await readFile(path.join(root, file))).toEqual(before);
  source.cards.reverse();
  await json(file, source);
  expect(await exportPackages(root, spec)).toEqual(result);
  const preserved = await readFile(path.join(root, receipt.path));
  source.cards[0].rarity = "ultra-rare";
  await json(file, source);
  expect(await exportPackages(root, spec)).toMatchObject({
    kind: "failed",
    error: { code: "PACKAGE_IDENTITY_CONFLICT" },
  });
  expect(await readFile(path.join(root, receipt.path))).toEqual(preserved);
});
it("rejects canonical references to missing catalog cards instead of silently excluding them", async () => {
  const { root, spec, library, json } = await fixture();
  const file = `${library}/sets/future-set.json`;
  const source = JSON.parse(await readFile(path.join(root, file), "utf8"));
  source.cards[0].cardCode = 999;
  await json(file, source);
  expect(await exportPackages(root, spec)).toMatchObject({
    kind: "failed",
    error: { code: "PACKAGE_SOURCE_INCOMPLETE", path: "sets/future-set.json" },
  });
  await expect(
    readdir(path.join(root, "generated/content-packages")),
  ).rejects.toMatchObject({ code: "ENOENT" });
});
it("rejects duplicate canonical printing identities without folding or silent loss", async () => {
  const { root, spec, library, json } = await fixture();
  const file = `${library}/sets/fixture-set.json`;
  const source = JSON.parse(await readFile(path.join(root, file), "utf8"));
  source.cards.push(source.cards[0]);
  await json(file, source);
  await expect(exportPackages(root, spec)).rejects.toMatchObject({
    code: "SOURCE_ENTITY_INVALID",
    source: file,
  });
  await expect(
    readdir(path.join(root, "generated/content-packages")),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

it("uses explicit source image extension and does not let flat rows truncate normalized global sources", async () => {
  const { root, spec, library, json } = await fixture();
  await json(`${library}/sets.json`, []);
  await json(`${library}/set-cards.json`, []);
  await json(`${library}/assets.json`, []);
  const set = JSON.parse(
    await readFile(path.join(root, library, "sets/future-set.json"), "utf8"),
  );
  set.imageAssetPath = "sets/future-set.png";
  await json(`${library}/sets/future-set.json`, set);
  await rm(path.join(root, library, "images/sets/future-set.jpg"));
  await writeFile(
    path.join(root, library, "images/sets/future-set.png"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const result = await exportPackages(root, spec);
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") return;
  const receipt = result.value.find((row) => row.packageId === "card-library")!;
  expect(receipt.excludedSetMemberships).toEqual([]);
  expect(receipt.rarityWarnings).toEqual([]);
  const db = new DatabaseSync(path.join(root, receipt.path), {
    readOnly: true,
  });
  try {
    expect(
      JSON.parse(
        String(
          db
            .prepare("SELECT metadata_json FROM sets WHERE id='future-set'")
            .get()!.metadata_json,
        ),
      ).imageAssetPath,
    ).toBe("sets/future-set.png");
    expect(
      db
        .prepare("SELECT mime FROM assets WHERE path='sets/future-set.png'")
        .get(),
    ).toEqual({ mime: "image/png" });
    expect(
      db.prepare("SELECT count(*) AS count FROM set_cards").get()!.count,
    ).toBe(2);
  } finally {
    db.close();
  }
});

it("projects validated authoring mapImage into chapter config without rewriting source", async () => {
  const { root, spec, chapter, json } = await fixture();
  const file = path.join(root, chapter, "story-documents.json");
  const stories = JSON.parse(await readFile(file, "utf8"));
  const config = JSON.parse(
    await readFile(path.join(root, chapter, "config.json"), "utf8"),
  );
  config.mapAssetPath = "media/map.svg";
  stories[0].mapImage = {
    packId: "chapter-01",
    path: "story/media/chapter-01/map.svg",
  };
  await json(`${chapter}/config.json`, config);
  await json(`${chapter}/story-documents.json`, stories);
  await json(`${chapter}/assets.json`, [
    {
      path: "media/map.svg",
      source: "media/map.svg",
      mime: "image/svg+xml",
      optional: true,
    },
  ]);
  const before = await readFile(file, "utf8");
  const result = await exportPackages(root, spec);
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") return;
  const db = new DatabaseSync(
    path.join(root, "generated/content-packages/chapter-01-1.0.0.sqlite"),
    { readOnly: true },
  );
  try {
    const stored = JSON.parse(
      String(
        db.prepare("SELECT payload_json FROM story_documents").get()!
          .payload_json,
      ),
    );
    const expected = { ...stories[0] };
    delete expected.mapImage;
    expect(stored).toEqual(expected);
  } finally {
    db.close();
  }
  expect(await readFile(file, "utf8")).toBe(before);
});

it.each([
  {
    mapImage: { packId: "chapter-02", path: "story/media/chapter-01/map.svg" },
  },
  {
    mapImage: {
      packId: "chapter-01",
      path: "story/media/chapter-01/other.svg",
    },
  },
  {
    mapImage: {
      packId: "chapter-01",
      path: "story/media/chapter-01/../map.svg",
    },
  },
  {
    mapImage: {
      packId: "chapter-01",
      path: "story/media/chapter-01/map.svg",
      unknown: true,
    },
  },
  { mapImage: null },
  {
    mapImage: { packId: "chapter-01", path: "story/media/chapter-01/map.svg" },
    unknown: true,
  },
])(
  "rejects malformed or mismatched authoring map metadata %j",
  async (metadata) => {
    const { root, spec, chapter, json } = await fixture();
    const stories = JSON.parse(
      await readFile(path.join(root, chapter, "story-documents.json"), "utf8"),
    );
    const config = JSON.parse(
      await readFile(path.join(root, chapter, "config.json"), "utf8"),
    );
    config.mapAssetPath = "media/map.svg";
    await json(`${chapter}/config.json`, config);
    await json(`${chapter}/story-documents.json`, [
      { ...stories[0], ...metadata },
    ]);
    expect(await exportPackages(root, spec)).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_SOURCE_INCOMPLETE",
        packageId: "chapter-01",
        path: "story-documents.json",
      },
    });
    await expect(
      readdir(path.join(root, "generated/content-packages")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  },
);

it("keeps inventory-only scripts, projects required cards, reports exact omissions", async () => {
  const { root, spec, json, library } = await fixture();
  const configPath = path.join(root, library, "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.requiredScripts.cards = ["c999.lua", "c1.lua"];
  await json(`${library}/config.json`, config);
  await json(`${library}/data/scripts/cards/00.json`, {
    "c1.lua": "-- required",
    "c2.lua": "-- outside chapter",
    "c999.lua": "-- inventory only",
  });
  await json(`${library}/data/scripts/index.json`, {
    official: ["c999.lua", "c1.lua"],
    preRelease: ["c2.lua"],
    globals: ["extra.lua", "utility.lua"],
    shardCount: 1,
    algorithm: "code-modulo",
  });
  const before = await readFile(configPath);
  const result = await exportPackages(root, spec);
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") return;
  expect(
    result.value.find(({ packageId }) => packageId === "card-library"),
  ).toHaveProperty("inventoryOnlyScripts", [
    { name: "c999.lua", reason: "missing-catalog-definition" },
  ]);
  for (const receipt of result.value.filter(
    ({ packageId }) => packageId !== "card-library",
  ))
    expect(receipt).toHaveProperty("inventoryOnlyScripts", []);
  const db = new DatabaseSync(
    path.join(root, "generated/content-packages/card-library-1.0.0.sqlite"),
    { readOnly: true },
  );
  try {
    expect(
      db.prepare("SELECT source FROM scripts WHERE name='c999.lua'").get(),
    ).toEqual({ source: "-- inventory only" });
    const stored = JSON.parse(
      String(
        db
          .prepare("SELECT value_json FROM package_meta WHERE key='config'")
          .get()!.value_json,
      ),
    );
    expect(stored.requiredScripts).toEqual({
      cards: ["c1.lua"],
      globals: config.requiredScripts.globals,
    });
  } finally {
    db.close();
  }
  expect(await readFile(configPath)).toEqual(before);
  await json(`${library}/config.json`, {
    ...config,
    requiredScripts: {
      ...config.requiredScripts,
      cards: [...config.requiredScripts.cards].reverse(),
    },
  });
  expect(await exportPackages(root, spec)).toEqual(result);
});

it("rejects missing declared normalized script before inventory projection", async () => {
  const { root, spec, json, library } = await fixture();
  const config = JSON.parse(
    await readFile(path.join(root, library, "config.json"), "utf8"),
  );
  config.requiredScripts.cards.push("c999.lua");
  await json(`${library}/config.json`, config);
  expect(await exportPackages(root, spec)).toEqual({
    kind: "failed",
    error: {
      code: "PACKAGE_SOURCE_INCOMPLETE",
      packageId: "card-library",
      path: "scripts/c999.lua",
    },
  });
});
