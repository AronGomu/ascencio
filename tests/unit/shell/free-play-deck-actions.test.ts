// @vitest-environment node

import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { deckId } from "../../../src/decks/deck-contracts.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { validateDeckDraft } from "../../../src/decks/deck-validation.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import {
  deleteLocalDeck,
  duplicateLocalDeck,
  parseLocalDeckKey,
  renameLocalDeck,
} from "../../../src/shell/screens/free-play-deck-actions.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

/* The three operations the free-play selection screen offers, against the real
   repository the screen writes to. `runtimeCatalog()` is pointed at the small
   fixture because duplicating a deck validates the copy against the catalog
   this page read, and a node test has no runtime assets to serve. */

installPrototypeActiveCatalog();

const catalog = catalogByCode(PROTOTYPE_CATALOG);
const mainCodes = PROTOTYPE_CATALOG.filter(
  (card) =>
    card.canonicalZone === "main" &&
    quantityLimit(PROTOTYPE_RULESET, card.code) === 3,
).map(({ code }) => code);
const VALID_MAIN = Array.from(
  { length: 40 },
  (_, index) => mainCodes[index % mainCodes.length]!,
);

async function seedDeck(id: string, name: string): Promise<void> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    const base = createBlankDeck(name, catalog, PROTOTYPE_RULESET, { id });
    await repository.create(
      {
        ...base,
        main: Object.freeze([...VALID_MAIN]),
        validation: validateDeckDraft(
          { main: [...VALID_MAIN], extra: [], side: [] },
          catalog,
          PROTOTYPE_RULESET,
        ),
      },
      emptyDeckHistory(),
    );
  } finally {
    repository.close();
  }
}

async function withRepository<T>(
  read: (repository: IndexedDbDeckRepository) => Promise<T>,
): Promise<T> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    return await read(repository);
  } finally {
    repository.close();
  }
}

beforeEach(async () => {
  await deleteDB(DECK_DATABASE_NAME);
  await seedDeck("built-deck", "Built Deck");
});

afterEach(async () => {
  await deleteDB(DECK_DATABASE_NAME);
});

describe("parseLocalDeckKey", () => {
  /* A local id may hold `:` itself — `deckId` forbids only `\0` — so the
     revision is read off the end rather than the id off the front. */
  it("reads the id and revision a local key carries", () => {
    expect(parseLocalDeckKey("local:abc:3")).toEqual({
      id: "abc",
      revision: 3,
    });
    expect(parseLocalDeckKey("local:a:b:c:7")).toEqual({
      id: "a:b:c",
      revision: 7,
    });
  });

  it("answers nothing for a bundled key", () => {
    expect(parseLocalDeckKey("preset:nekroz")).toBeNull();
  });
});

describe("free-play deck actions", () => {
  it("renames a deck and bumps its revision", async () => {
    await renameLocalDeck("local:built-deck:1", "  New Name  ");

    const stored = await withRepository((repository) =>
      repository.load(deckId("built-deck")),
    );
    expect(stored?.deck.name).toBe("New Name");
    expect(stored?.deck.revision).toBe(2);
  });

  it("duplicates a deck into an independent copy", async () => {
    await duplicateLocalDeck("local:built-deck:1");

    const records = await withRepository((repository) => repository.list());
    expect(records).toHaveLength(2);
    const copy = records.find(({ id }) => id !== "built-deck");
    expect(copy?.name).toBe("Built Deck Copy");
    expect(copy?.main).toEqual([...VALID_MAIN]);
    /* Its own row from its first revision, so editing one deck never edits the
       other. */
    expect(copy?.revision).toBe(1);
  });

  it("duplicates a bundled deck into an independent local copy", async () => {
    await duplicateLocalDeck("preset:starter", {
      name: "Bundled Starter",
      lists: { main: VALID_MAIN, extra: [], side: [] },
    });

    const records = await withRepository((repository) => repository.list());
    const copy = records.find(({ id }) => id !== "built-deck");
    expect(copy?.name).toBe("Bundled Starter Copy");
    expect(copy?.main).toEqual([...VALID_MAIN]);
    expect(copy?.revision).toBe(1);
  });

  it("deletes a deck at the revision its key names", async () => {
    await deleteLocalDeck("local:built-deck:1");

    expect(await withRepository((repository) => repository.list())).toEqual([]);
  });

  /* The screen never offers these on a bundled deck — the tile is not
     deletable and the key is a preset — so the throw is the guard behind that,
     not a message a player is meant to read. */
  it("refuses every operation on a bundled deck", async () => {
    await expect(renameLocalDeck("preset:nekroz", "x")).rejects.toThrow(
      "Bundled decks cannot be modified",
    );
    await expect(duplicateLocalDeck("preset:nekroz")).rejects.toThrow(
      "Bundled decks cannot be modified",
    );
    await expect(deleteLocalDeck("preset:nekroz")).rejects.toThrow(
      "Bundled decks cannot be modified",
    );
  });

  /* A deck another tab deleted between the listing and the press: the listing
     is re-read straight after, and it will not show it. */
  it("leaves a deck that is already gone alone", async () => {
    await deleteLocalDeck("local:built-deck:1");

    await expect(
      renameLocalDeck("local:built-deck:1", "New Name"),
    ).resolves.toBeUndefined();
    await expect(
      duplicateLocalDeck("local:built-deck:1"),
    ).resolves.toBeUndefined();
    expect(await withRepository((repository) => repository.list())).toEqual([]);
  });
});
