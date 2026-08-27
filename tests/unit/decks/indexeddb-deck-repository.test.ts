// @vitest-environment node

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import {
  deckId,
  type DeckAutosaveRecord,
} from "../../../src/decks/deck-contracts.ts";
import {
  emptyDeckHistory,
  pushDeckUpdate,
} from "../../../src/decks/deck-history.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { validateDeckDraft } from "../../../src/decks/deck-validation.ts";
import {
  DECK_DATABASE_NAME,
  DECK_DATABASE_VERSION,
  LEGACY_DECK_DATABASE_NAME,
  MAXIMUM_DECK_AUTOSAVES,
} from "../../../src/decks/deck-database.ts";
import {
  deckDatabaseNames,
  DECK_DATABASE_VERSION_1,
  openDeckDatabase,
  seedDeckDatabase,
} from "../../fixtures/deck-database.ts";
import {
  DeckRevisionConflictError,
  DeckStorageError,
  IndexedDbDeckRepository,
} from "../../../src/decks/indexeddb-deck-repository.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";

const names: string[] = [];
const catalog = catalogByCode(PROTOTYPE_CATALOG);

afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => deleteDB(name)));
  await deleteDB(LEGACY_DECK_DATABASE_NAME);
  await deleteDB(DECK_DATABASE_NAME);
});

async function repository(name: string): Promise<IndexedDbDeckRepository> {
  names.push(name);
  return IndexedDbDeckRepository.open(
    name,
    () => new Date("2026-01-01T00:00:00.000Z"),
  );
}

/* Distinct timestamps throughout: the log is ordered by `createdAt`, so two
   entries written in the same millisecond have no defined order and would make
   an ordering assertion a coin flip. */
function autosave(id: string, createdAt: string): DeckAutosaveRecord {
  return {
    id,
    deckId: deckId("logged"),
    deckName: "Logged",
    createdAt,
    main: [89631139],
    extra: [],
    side: [],
  };
}

describe("IndexedDbDeckRepository", () => {
  it(
    "rejects with DeckStorageError when another connection blocks the upgrade",
    { timeout: 2000 },
    async () => {
      const name = "deck-repo-blocked";
      names.push(name);
      /* Hold a version-1 connection open — any open at version 2 will fire
         `blocked` and must not hang forever. */
      const held = await openDeckDatabase(name, DECK_DATABASE_VERSION_1);
      try {
        await expect(
          IndexedDbDeckRepository.open(
            name,
            () => new Date("2026-01-01T00:00:00.000Z"),
          ),
        ).rejects.toBeInstanceOf(DeckStorageError);
      } finally {
        held.close();
      }
    },
  );

  it("defaults to the production deck database", async () => {
    expect(DECK_DATABASE_NAME).toBe("ygo-story-decks");
    const repo = await IndexedDbDeckRepository.open();
    repo.close();
    expect((await indexedDB.databases()).map(({ name }) => name)).toContain(
      DECK_DATABASE_NAME,
    );
  });

  /* The one place the migration and the repository meet: opening the default
     database has to move a prototype player's decks across before the first
     read, or the library renders empty and the player thinks they lost them.
     The repository caches its migration for the lifetime of the module, which
     is what a page load wants and what a second test in the same file does not,
     so this one runs against a freshly-registered module. */
  it("migrates a prototype database before the first read", async () => {
    const draft = createBlankDeck(
      "Prototype Deck",
      catalog,
      PROTOTYPE_RULESET,
      {
        id: "prototype-deck",
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
    );
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [{ ...draft, revision: 1 }],
    });

    vi.resetModules();
    const { IndexedDbDeckRepository: FreshRepository } =
      await import("../../../src/decks/indexeddb-deck-repository.ts");
    const repo = await FreshRepository.open();
    expect((await repo.list()).map(({ name }) => name)).toEqual([
      "Prototype Deck",
    ]);
    expect((await repo.load(draft.id))?.history.undo).toEqual([]);
    repo.close();
    expect(await deckDatabaseNames()).not.toContain(LEGACY_DECK_DATABASE_NAME);
  });

  it("atomically creates, saves, lists, reloads, and deletes deck plus history", async () => {
    const repo = await repository("deck-repo-lifecycle");
    const draft = createBlankDeck("Control", catalog, PROTOTYPE_RULESET, {
      id: "control",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const created = await repo.createAndOpen(draft, emptyDeckHistory());
    expect(created.deck.revision).toBe(1);
    expect(await repo.getLastOpened()).toBe(created.deck.id);
    await repo.clearLastOpened(deckId("another-deck"));
    expect(await repo.getLastOpened()).toBe(created.deck.id);

    const history = pushDeckUpdate(created.history, {
      id: "add-one",
      deckId: created.deck.id,
      before: created.deck,
      after: { main: [89631139], extra: [], side: [] },
      reason: "add",
    });
    const saved = await repo.save(
      1,
      { ...created.deck, main: [89631139] },
      history,
    );
    expect(saved.deck.revision).toBe(2);
    expect((await repo.load(created.deck.id))?.history.undo).toHaveLength(1);
    expect(await repo.list()).toHaveLength(1);

    await repo.delete(created.deck.id, 2);
    expect(await repo.load(created.deck.id)).toBeNull();
    expect(await repo.getLastOpened()).toBeNull();
    repo.close();
  });

  it("rejects stale revisions without overwriting committed state", async () => {
    const repo = await repository("deck-repo-conflict");
    const draft = createBlankDeck("Conflict", catalog, PROTOTYPE_RULESET, {
      id: "conflict",
    });
    const created = await repo.create(draft, emptyDeckHistory());
    await repo.save(1, { ...created.deck, name: "Newer" }, created.history);
    await expect(
      repo.save(1, { ...created.deck, name: "Stale" }, created.history),
    ).rejects.toBeInstanceOf(DeckRevisionConflictError);
    expect((await repo.load(deckId("conflict")))?.deck.name).toBe("Newer");
    repo.close();
  });

  it("rejects stale deletes while keeping deck and history intact", async () => {
    const repo = await repository("deck-repo-stale-delete");
    const draft = createBlankDeck(
      "Delete conflict",
      catalog,
      PROTOTYPE_RULESET,
      {
        id: "delete-conflict",
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
    );
    const created = await repo.create(draft, emptyDeckHistory());
    const saved = await repo.save(
      1,
      { ...created.deck, name: "Revision two" },
      created.history,
    );
    await expect(repo.delete(saved.deck.id, 1)).rejects.toBeInstanceOf(
      DeckRevisionConflictError,
    );
    expect((await repo.load(saved.deck.id))?.deck.name).toBe("Revision two");
    await repo.delete(saved.deck.id, 2);
    await expect(repo.delete(saved.deck.id, 2)).resolves.toBeUndefined();
    repo.close();
  });

  /* Positions never enter the history, so the stored deck and the newest undo
     entry legitimately disagree on order while holding the same cards. The
     consistency check has to read that as one state, or every manual reorder
     would make its own deck unloadable. */
  it("a reordered deck still loads against its unreordered history", async () => {
    const repo = await repository("deck-repo-reorder");
    const draft = createBlankDeck("Reordered", catalog, PROTOTYPE_RULESET, {
      id: "reordered",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const created = await repo.createAndOpen(draft, emptyDeckHistory());
    const history = pushDeckUpdate(created.history, {
      id: "add-two",
      deckId: created.deck.id,
      before: created.deck,
      after: { main: [89631139, 46986414], extra: [], side: [] },
      reason: "add",
    });
    await repo.save(
      1,
      { ...created.deck, main: [89631139, 46986414] },
      history,
    );
    await repo.save(
      2,
      { ...created.deck, main: [46986414, 89631139] },
      history,
    );
    expect((await repo.load(created.deck.id))?.deck.main).toEqual([
      46986414, 89631139,
    ]);
    repo.close();
  });

  it("rejects malformed persisted rows before exposing them", async () => {
    const name = "deck-repo-malformed";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    repo.close();
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, DECK_DATABASE_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ["decks", "histories"],
      "readwrite",
    );
    transaction.objectStore("decks").put({
      schemaVersion: 1,
      id: "malformed",
      revision: 1,
      name: "Malformed",
      main: [89631139],
      extra: [],
      side: [],
    });
    transaction.objectStore("histories").put({
      deckId: "malformed",
      history: emptyDeckHistory(),
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    const reopened = await IndexedDbDeckRepository.open(name);
    expect(await reopened.list()).toEqual([]);
    await expect(reopened.load(deckId("malformed"))).rejects.toBeInstanceOf(
      DeckStorageError,
    );
    reopened.close();
  });

  it("restores invalid drafts and bounded history after reopening", async () => {
    const name = "deck-repo-reload";
    const first = await repository(name);
    const draft = createBlankDeck("Invalid draft", catalog, PROTOTYPE_RULESET, {
      id: "invalid",
    });
    let history = emptyDeckHistory();
    for (let index = 0; index < 51; index += 1)
      history = pushDeckUpdate(history, {
        id: `u-${index}`,
        deckId: draft.id,
        before: { main: [index + 1], extra: [], side: [] },
        after: { main: [index + 2], extra: [], side: [] },
        reason: "add",
      });
    const persisted = {
      ...draft,
      main: [52],
      validation: validateDeckDraft(
        { main: [52], extra: [], side: [] },
        catalog,
        PROTOTYPE_RULESET,
      ),
    };
    await first.create(persisted, history);
    first.close();

    const second = await IndexedDbDeckRepository.open(name);
    const loaded = await second.load(draft.id);
    expect(loaded?.deck.validation.status).toBe("errors");
    expect(loaded?.history.undo).toHaveLength(50);
    second.close();
  });
});

describe("the deck autosave log", () => {
  it("appendAutosave stores entries readable newest first", async () => {
    const repo = await repository("deck-repo-autosave-order");
    /* Appended out of order, so the read proves it sorts by `createdAt` rather
       than handing back insertion order. */
    await repo.appendAutosave(autosave("older", "2026-01-01T00:00:00.000Z"));
    await repo.appendAutosave(autosave("newest", "2026-01-03T00:00:00.000Z"));
    await repo.appendAutosave(autosave("newer", "2026-01-02T00:00:00.000Z"));

    expect((await repo.listAutosaves()).map(({ id }) => id)).toEqual([
      "newest",
      "newer",
      "older",
    ]);
    repo.close();
  });

  it("the autosave log keeps only the newest 100 entries", async () => {
    const repo = await repository("deck-repo-autosave-cap");
    const total = MAXIMUM_DECK_AUTOSAVES + 5;
    for (let index = 0; index < total; index += 1)
      await repo.appendAutosave(
        autosave(
          `entry-${String(index)}`,
          new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        ),
      );

    const entries = await repo.listAutosaves();
    expect(entries).toHaveLength(MAXIMUM_DECK_AUTOSAVES);
    expect(entries[0]?.id).toBe(`entry-${String(total - 1)}`);
    expect(entries.at(-1)?.id).toBe("entry-5");
    expect(entries.some(({ id }) => id === "entry-4")).toBe(false);
    repo.close();
  });

  /* The log is a convenience surface, not deck data: one unreadable row must
     not take the rest of a player's history down with it. */
  it("skips malformed autosave rows instead of failing the read", async () => {
    const name = "deck-repo-autosave-malformed";
    const repo = await repository(name);
    await repo.appendAutosave(autosave("valid", "2026-01-01T00:00:00.000Z"));
    repo.close();

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, DECK_DATABASE_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("autosaves", "readwrite");
    transaction.objectStore("autosaves").put({
      id: "malformed",
      deckId: "logged",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();

    const reopened = await IndexedDbDeckRepository.open(name);
    expect((await reopened.listAutosaves()).map(({ id }) => id)).toEqual([
      "valid",
    ]);
    reopened.close();
  });
});

describe("the default deck preference", () => {
  it("setDefaultDeck persists and getDefaultDeck reads it back", async () => {
    const repo = await repository("deck-repo-default-round-trip");
    const deck = createBlankDeck("Default", catalog, PROTOTYPE_RULESET, {
      id: "defaulted",
    });
    await repo.create(deck, emptyDeckHistory());
    expect(await repo.getDefaultDeck()).toBeNull();
    await repo.setDefaultDeck(deck.id);
    expect(await repo.getDefaultDeck()).toBe(deck.id);
    await repo.setDefaultDeck(null);
    expect(await repo.getDefaultDeck()).toBeNull();
    repo.close();
  });

  /* A default pointing at a deck that is gone is a deck picker offering
     nothing, so the delete that removes the deck removes the preference. */
  it("deleting the default deck clears the preference", async () => {
    const repo = await repository("deck-repo-default-cleared-on-delete");
    const deck = createBlankDeck("Doomed", catalog, PROTOTYPE_RULESET, {
      id: "doomed",
    });
    const created = await repo.create(deck, emptyDeckHistory());
    await repo.setDefaultDeck(deck.id);
    await repo.delete(deck.id, created.deck.revision);
    expect(await repo.getDefaultDeck()).toBeNull();
    repo.close();
  });

  /* A row can outlive its deck when storage is edited outside the repository,
     so the read verifies the deck rather than trusting the preference. */
  it("reads a default naming a deck that is gone as none set", async () => {
    const name = "deck-repo-default-dangling";
    const repo = await repository(name);
    repo.close();
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, DECK_DATABASE_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("preferences", "readwrite");
    transaction
      .objectStore("preferences")
      .put({ key: "default-deck", value: "vanished" });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();

    const reopened = await IndexedDbDeckRepository.open(name);
    expect(await reopened.getDefaultDeck()).toBeNull();
    reopened.close();
  });

  it("setDefaultDeck refuses a missing deck", async () => {
    const repo = await repository("deck-repo-default-missing");
    await expect(repo.setDefaultDeck(deckId("absent"))).rejects.toBeInstanceOf(
      DeckStorageError,
    );
    expect(await repo.getDefaultDeck()).toBeNull();
    repo.close();
  });
});

describe("the favourite decks preference", () => {
  it("favourites persist and drop deleted decks", async () => {
    const repo = await repository("deck-repo-favourites-round-trip");
    const deckA = createBlankDeck("Alpha", catalog, PROTOTYPE_RULESET, {
      id: "fav-a",
    });
    const deckB = createBlankDeck("Beta", catalog, PROTOTYPE_RULESET, {
      id: "fav-b",
    });
    const createdA = await repo.create(deckA, emptyDeckHistory());
    const createdB = await repo.create(deckB, emptyDeckHistory());

    await repo.setFavourite(deckA.id, true);
    await repo.setFavourite(deckB.id, true);
    expect(await repo.listFavourites()).toEqual(
      expect.arrayContaining([deckA.id, deckB.id]),
    );

    await repo.delete(deckB.id, createdB.deck.revision);
    expect(await repo.listFavourites()).toEqual([createdA.deck.id]);
    repo.close();
  });

  it("setFavourite refuses a missing deck", async () => {
    const repo = await repository("deck-repo-favourites-missing");
    await expect(
      repo.setFavourite(deckId("absent"), true),
    ).rejects.toBeInstanceOf(DeckStorageError);
    expect(await repo.listFavourites()).toEqual([]);
    repo.close();
  });

  it("unfavouring a deck removes it from the list", async () => {
    const repo = await repository("deck-repo-favourites-remove");
    const deck = createBlankDeck("Removable", catalog, PROTOTYPE_RULESET, {
      id: "fav-remove",
    });
    await repo.create(deck, emptyDeckHistory());
    await repo.setFavourite(deck.id, true);
    expect(await repo.listFavourites()).toEqual([deck.id]);
    await repo.setFavourite(deck.id, false);
    expect(await repo.listFavourites()).toEqual([]);
    repo.close();
  });
});
