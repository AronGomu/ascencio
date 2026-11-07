import { expect, it } from "vitest";
import { validatePackageDatabase } from "../../../src/storage/schema/index.ts";
import { createPackageFixture } from "./sqlite-fixtures.ts";

it.each([null, 1, 2002, 9999])(
  "retains global releaseYear %s without inventing dates",
  (releaseYear) => {
    const { database, reader } = createPackageFixture("card-library");
    try {
      database.prepare("UPDATE sets SET metadata_json=?").run(
        JSON.stringify({
          id: "fixture-set",
          name: "Fixture Set",
          releaseYear,
          imageAssetPath: null,
        }),
      );
      expect(validatePackageDatabase(reader).kind).toBe("ok");
      expect(
        JSON.parse(
          String(
            database.prepare("SELECT metadata_json FROM sets").get()!
              .metadata_json,
          ),
        ).releaseYear,
      ).toBe(releaseYear);
    } finally {
      database.close();
    }
  },
);

it.each([0, -1, 10000, 2002.5, "2002", false, {}, []])(
  "rejects invalid global releaseYear %s",
  (releaseYear) => {
    const { database, reader } = createPackageFixture("card-library");
    try {
      database.prepare("UPDATE sets SET metadata_json=?").run(
        JSON.stringify({
          id: "fixture-set",
          name: "Fixture Set",
          releaseYear,
          imageAssetPath: null,
        }),
      );
      expect(validatePackageDatabase(reader)).toMatchObject({
        kind: "failed",
        error: { code: "PACKAGE_INVALID" },
      });
    } finally {
      database.close();
    }
  },
);

it("preserves source rarity/code variants; rejects identical identity and broken FKs", () => {
  const { database, reader } = createPackageFixture("card-library");
  try {
    database.exec("PRAGMA foreign_keys=ON");
    const insert = database.prepare(
      "INSERT INTO set_cards VALUES (?, ?, ?, ?, ?, ?)",
    );
    insert.run("fixture-set", 1, "FIX-001", "common", "Short Print", "SP");
    insert.run("fixture-set", 1, "FIX-001", "common", "Common", "");
    expect(() =>
      insert.run("fixture-set", 1, "FIX-001", "rare", "Common", "C"),
    ).toThrow(/UNIQUE constraint failed/);
    expect(() =>
      insert.run("fixture-set", 9, "FIX-001", "common", "Common", "C"),
    ).toThrow(/FOREIGN KEY constraint failed/);
    expect(() =>
      insert.run("missing", 1, "FIX-001", "common", "Common", "C"),
    ).toThrow(/FOREIGN KEY constraint failed/);
    expect(
      database.prepare("SELECT count(*) AS count FROM set_cards").get()!.count,
    ).toBe(3);
    expect(
      database
        .prepare('PRAGMA index_info("sqlite_autoindex_set_cards_1")')
        .all()
        .map((row) => row.name),
    ).toEqual([
      "set_id",
      "card_code",
      "printing_code",
      "source_rarity",
      "source_rarity_code",
    ]);
    expect(validatePackageDatabase(reader).kind).toBe("ok");
  } finally {
    database.close();
  }
});

it.each([
  [
    "prior printing PK",
    (sql: string) =>
      sql.replace(
        "PRIMARY KEY (set_id, card_code, printing_code, source_rarity, source_rarity_code)",
        "PRIMARY KEY (set_id, card_code, printing_code)",
      ),
  ],
  [
    "nullable source rarity",
    (sql: string) =>
      sql.replace("source_rarity TEXT NOT NULL", "source_rarity TEXT"),
  ],
  [
    "nullable source rarity code",
    (sql: string) =>
      sql.replace(
        "source_rarity_code TEXT NOT NULL",
        "source_rarity_code TEXT",
      ),
  ],
  [
    "printing collation",
    (sql: string) =>
      sql.replace(
        "source_rarity TEXT NOT NULL",
        "source_rarity TEXT NOT NULL COLLATE NOCASE",
      ),
  ],
  [
    "missing card FK",
    (sql: string) => sql.replaceAll("REFERENCES cards(code)", ""),
  ],
] as const)(
  "rejects hostile or obsolete schema: %s",
  (_name, transformSchema) => {
    const { database, reader } = createPackageFixture("card-library", {
      transformSchema,
    });
    try {
      expect(validatePackageDatabase(reader)).toMatchObject({
        kind: "failed",
        error: { code: "PACKAGE_INVALID" },
      });
    } finally {
      database.close();
    }
  },
);
