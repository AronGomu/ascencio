import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("retired deck persistence APIs", () => {
  it.each([
    "src/decks/indexeddb-deck-repository.ts",
    "src/decks/deck-database.ts",
  ])("removes legacy storage and migration module %s", (file) => {
    expect(existsSync(file)).toBe(false);
  });

  it("has no migration-specific editor branch", () => {
    expect(
      readFileSync("src/deck-editor/DeckEditorApp.svelte", "utf8"),
    ).not.toMatch(/DeckMigrationError|migrationError|deck-migration-/);
  });
});
