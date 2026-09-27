// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sources(file)
      : /\.(ts|svelte)$/.test(file)
        ? [file]
        : [];
  });
}

function exportedNames(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  return source.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    statement.exportClause &&
    ts.isNamedExports(statement.exportClause)
      ? statement.exportClause.elements.map((element) => element.name.text)
      : [],
  );
}

const retiredSymbols = [
  "createStorySaveRepository",
  "createStorySaveStores",
  "STORY_SAVES_DATABASE_NAME",
  "STORY_SAVES_DATABASE_VERSION",
  "STORY_SAVES_STORE_NAME",
  "STORY_SAVE_SCHEMA_VERSION",
  "OLDEST_READABLE_SCHEMA_VERSION",
  "parseStorySaveEnvelope",
  "migrateStorySaveState",
  "summarizeStorySave",
  "buildLegacyStarterGrant",
];

describe("retired Story persistence boundary", () => {
  it("removes the legacy repository implementation and its dedicated suite", () => {
    for (const file of [
      "src/story/saves/story-save-repository.ts",
      "tests/unit/story/story-save-repository.test.ts",
    ])
      expect(existsSync(file), file).toBe(false);
  });

  it("exports current SQLite saves without legacy construction or DB names", () => {
    for (const file of ["src/story/index.ts", "src/story/saves/index.ts"])
      expect(exportedNames(file), file).not.toEqual(
        expect.arrayContaining(["STORY_SAVES_DATABASE_NAME"]),
      );
    expect(exportedNames("src/story/saves/index.ts")).toContain(
      "createSqliteStoryRepository",
    );
  });

  it("leaves no Story legacy migration or browser persistence capability", () => {
    for (const file of sources("src/story")) {
      const source = readFileSync(file, "utf8");
      for (const symbol of retiredSymbols)
        expect(source, `${file}: ${symbol}`).not.toMatch(
          new RegExp(`\\b${symbol}\\b`),
        );
      expect(source, file).not.toMatch(
        /\b(?:indexedDB|IDBFactory|IDBDatabase|IDBTransaction|IDBObjectStore|openDB|deleteDB)\b/,
      );
      expect(source, file).not.toMatch(/from\s+["']idb["']/);
    }
  });

  it("retains current structural validators and schema6 contracts", () => {
    const current = readFileSync(
      "src/story/saves/generation-contracts.ts",
      "utf8",
    );
    expect(current).toContain("readonly schemaVersion: 6");
    expect(current).toContain("interface GenerationSaveRepository");
    const pure = readFileSync(
      "src/story/saves/story-save-contracts.ts",
      "utf8",
    );
    expect(pure).toContain("export function isStoryDeck");
    expect(pure).toContain("export function isStoryState");
    expect(pure).not.toMatch(/readonly schemaVersion: [1-5];/);
  });
});
