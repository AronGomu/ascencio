// @vitest-environment node

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { deckId, type DeckRecord } from "../../../src/decks/deck-contracts.ts";
import {
  DECK_DATABASE_NAME,
  DECK_DATABASE_VERSION,
  DeckMigrationError,
  LEGACY_DECK_DATABASE_NAME,
  LEGACY_DECK_DATABASE_VERSION,
  migrateLegacyDeckDatabase,
} from "../../../src/decks/deck-database.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import {
  DECK_DATABASE_VERSION_1,
  deckDatabaseNames,
  deckDatabaseRows,
  deckDatabaseVersion,
  openDeckDatabase,
  seedDeckDatabase,
} from "../../fixtures/deck-database.ts";

/* The migration is the one code path that can destroy a real player's decks,
   so every case here drives the two fixed database names through the same
   `fake-indexeddb` factory the repository sees in a browser. */

const LAST_OPENED_KEY = "last-opened-deck";
const originalPut = IDBObjectStore.prototype.put;

afterEach(async () => {
  IDBObjectStore.prototype.put = originalPut;
  await deleteDB(LEGACY_DECK_DATABASE_NAME);
  await deleteDB(DECK_DATABASE_NAME);
});

function deckRecord(id: string, revision = 1): DeckRecord {
  return {
    schemaVersion: 1,
    id: deckId(id),
    revision,
    name: `Deck ${id}`,
    main: [89631139],
    extra: [],
    side: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    validation: {
      status: "valid",
      issues: [],
      rulesetRevision: "prototype-2026-01",
    },
    importedNeedsReview: false,
  };
}

async function deckIdsIn(name: string): Promise<readonly string[]> {
  const rows = (await deckDatabaseRows(name, "decks")) as DeckRecord[];
  return rows.map(({ id }) => id).sort();
}

/** The rejection the migration produced, or a failure if it resolved. */
async function migrationFailure(): Promise<DeckMigrationError> {
  try {
    await migrateLegacyDeckDatabase(indexedDB);
  } catch (error) {
    if (error instanceof DeckMigrationError) return error;
    throw error;
  }
  throw new Error("Expected the migration to reject");
}

/** Rewrites one deck's key on the way in, so the copy lands incomplete without
    the write itself failing — exactly what the verification pass must catch. */
function loseDeckOnWrite(lost: string): void {
  IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
    const deck = value as { id?: string };
    if (this.name === "decks" && deck.id === lost)
      return originalPut.call(this, { ...deck, id: `${lost}-lost` }, key);
    return originalPut.call(this, value, key);
  };
}

function failWriteOnDeck(failing: string): void {
  IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
    if (this.name === "decks" && (value as { id?: string }).id === failing)
      throw new Error("simulated write failure");
    return originalPut.call(this, value, key);
  };
}

describe("deck database names", () => {
  it("separates the production database from the prototype it replaces", () => {
    expect(DECK_DATABASE_NAME).toBe("ygo-story-decks");
    expect(LEGACY_DECK_DATABASE_NAME).toBe(
      "ygo-story-duel-deck-builder-prototype",
    );
  });
});

describe("migrateLegacyDeckDatabase", () => {
  it("does nothing for a player who has no prototype database", async () => {
    await seedDeckDatabase(DECK_DATABASE_NAME, { decks: [deckRecord("a")] });

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 0,
      legacyDeleted: false,
    });
    /* A probe that created the prototype database to look for it would leave a
       husk behind, and the next run would try to migrate from it. */
    expect(await deckDatabaseNames()).not.toContain(LEGACY_DECK_DATABASE_NAME);
    expect(await deckIdsIn(DECK_DATABASE_NAME)).toEqual(["a"]);
  });

  it("copies every deck, history and the last-opened pointer", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("a"), deckRecord("b", 3), deckRecord("c")],
      lastOpened: "b",
    });

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 3,
      legacyDeleted: true,
    });
    const decks = (await deckDatabaseRows(
      DECK_DATABASE_NAME,
      "decks",
    )) as DeckRecord[];
    expect(decks.map(({ id }) => id).sort()).toEqual(["a", "b", "c"]);
    expect(decks.find(({ id }) => id === "b")?.revision).toBe(3);
    expect(
      await deckDatabaseRows(DECK_DATABASE_NAME, "histories"),
    ).toHaveLength(3);
    expect(await deckDatabaseRows(DECK_DATABASE_NAME, "preferences")).toEqual([
      { key: LAST_OPENED_KEY, value: "b" },
    ]);
  });

  it("deletes the prototype database only once the copy verifies", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("a")],
    });

    const report = await migrateLegacyDeckDatabase(indexedDB);

    expect(report.legacyDeleted).toBe(true);
    expect(await deckDatabaseNames()).not.toContain(LEGACY_DECK_DATABASE_NAME);
  });

  it("keeps both databases when a deck is lost during the copy", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("a"), deckRecord("b"), deckRecord("c")],
    });
    loseDeckOnWrite("b");

    expect((await migrationFailure()).cause).toBe("verify-failed");
    expect(await deckDatabaseNames()).toContain(LEGACY_DECK_DATABASE_NAME);
    expect(await deckIdsIn(LEGACY_DECK_DATABASE_NAME)).toEqual(["a", "b", "c"]);
  });

  it("reports a failed write without deleting or half-copying anything", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("a"), deckRecord("b"), deckRecord("c")],
    });
    failWriteOnDeck("b");

    expect((await migrationFailure()).cause).toBe("copy-failed");
    expect(await deckDatabaseNames()).toContain(LEGACY_DECK_DATABASE_NAME);
    expect(await deckIdsIn(LEGACY_DECK_DATABASE_NAME)).toEqual(["a", "b", "c"]);
    /* One transaction, so an aborted copy leaves no partial deck behind. */
    expect(await deckIdsIn(DECK_DATABASE_NAME)).toEqual([]);
  });

  it("reports a blocked delete and leaves the copied decks intact", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("a")],
    });
    /* A second tab holding the prototype database open is what blocks the
       delete in a browser; this connection is that tab. */
    const otherTab = await openDeckDatabase(LEGACY_DECK_DATABASE_NAME);

    try {
      expect((await migrationFailure()).cause).toBe("delete-failed");
      expect(await deckIdsIn(DECK_DATABASE_NAME)).toEqual(["a"]);
    } finally {
      otherTab.close();
    }
  });

  it("is idempotent: a second run copies and deletes nothing", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("a"), deckRecord("b")],
    });

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 2,
      legacyDeleted: true,
    });
    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 0,
      legacyDeleted: false,
    });
    expect(await deckIdsIn(DECK_DATABASE_NAME)).toEqual(["a", "b"]);
  });

  it("finishes an interrupted run whose copy landed but whose delete did not", async () => {
    const decks = [deckRecord("a"), deckRecord("b", 2)];
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks,
      lastOpened: "a",
    });
    await seedDeckDatabase(DECK_DATABASE_NAME, { decks, lastOpened: "a" });

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 0,
      legacyDeleted: true,
    });
    expect(await deckDatabaseNames()).not.toContain(LEGACY_DECK_DATABASE_NAME);
    expect(await deckIdsIn(DECK_DATABASE_NAME)).toEqual(["a", "b"]);
  });

  it("keeps a prototype database that holds decks the production one lacks", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("prototype-only")],
    });
    await seedDeckDatabase(DECK_DATABASE_NAME, {
      decks: [deckRecord("production-only")],
    });

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 0,
      legacyDeleted: false,
    });
    expect(await deckIdsIn(DECK_DATABASE_NAME)).toEqual(["production-only"]);
    expect(await deckIdsIn(LEGACY_DECK_DATABASE_NAME)).toEqual([
      "prototype-only",
    ]);
  });

  it("keeps a prototype database whose deck is newer than the copied one", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("a", 3)],
    });
    await seedDeckDatabase(DECK_DATABASE_NAME, { decks: [deckRecord("a", 1)] });

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 0,
      legacyDeleted: false,
    });
    expect(await deckDatabaseNames()).toContain(LEGACY_DECK_DATABASE_NAME);
  });

  it("cleans up a prototype database that holds no decks", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME);

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 0,
      legacyDeleted: true,
    });
    expect(await deckDatabaseNames()).not.toContain(LEGACY_DECK_DATABASE_NAME);
  });
});

/* The prototype database is the one thing the version bump could quietly
   destroy. Opening it at the production version fires `upgradeneeded` on a real
   player's decks, `openLegacyDatabase` reads that flag as "this database did not
   exist until I created it", and deletes what it just upgraded. */
describe("the deck database version bump", () => {
  it("the legacy prototype database is opened at version 1 and never upgraded", async () => {
    expect(LEGACY_DECK_DATABASE_VERSION).toBe(1);
    expect(DECK_DATABASE_VERSION).toBeGreaterThan(LEGACY_DECK_DATABASE_VERSION);
    /* Diverged, so the prototype database survives the run and its version is
       still there to look at afterwards. */
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("prototype-only")],
    });
    await seedDeckDatabase(DECK_DATABASE_NAME, {
      decks: [deckRecord("production-only")],
    });

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 0,
      legacyDeleted: false,
    });

    expect(await deckDatabaseVersion(LEGACY_DECK_DATABASE_NAME)).toBe(
      LEGACY_DECK_DATABASE_VERSION,
    );
    expect(await deckIdsIn(LEGACY_DECK_DATABASE_NAME)).toEqual([
      "prototype-only",
    ]);
  });

  it("still migrates a version-1 prototype database after the bump", async () => {
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [deckRecord("prototype")],
      lastOpened: "prototype",
    });

    expect(await migrateLegacyDeckDatabase(indexedDB)).toEqual({
      migrated: 1,
      legacyDeleted: true,
    });
    expect(await deckIdsIn(DECK_DATABASE_NAME)).toEqual(["prototype"]);
  });

  it("a version-1 production database upgrades to version 2 keeping decks and gaining autosaves", async () => {
    await seedDeckDatabase(
      DECK_DATABASE_NAME,
      { decks: [deckRecord("kept")], lastOpened: "kept" },
      DECK_DATABASE_VERSION_1,
    );

    const repository = await IndexedDbDeckRepository.open();
    try {
      expect((await repository.list()).map(({ id }) => id)).toEqual(["kept"]);
      expect(await repository.getLastOpened()).toBe("kept");
      expect((await repository.load(deckId("kept")))?.deck.name).toBe(
        "Deck kept",
      );

      await repository.appendAutosave({
        id: "first",
        deckId: deckId("kept"),
        deckName: "Deck kept",
        createdAt: "2026-02-01T00:00:00.000Z",
        main: [89631139],
        extra: [],
        side: [],
      });
      expect((await repository.listAutosaves()).map(({ id }) => id)).toEqual([
        "first",
      ]);
    } finally {
      repository.close();
    }
    expect(await deckDatabaseVersion(DECK_DATABASE_NAME)).toBe(
      DECK_DATABASE_VERSION,
    );
  });
});
