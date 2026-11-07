import {
  openTestDeckRepository,
  disposeTestDeckRepositories,
  withTestDeckDatabase,
  testDeckDatabaseBytes,
} from "../../fixtures/sqlite-deck-repository.ts";
// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
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
import { MAXIMUM_DECK_AUTOSAVES } from "../../../src/decks/deck-autosave.ts";
import {
  DeckRevisionConflictError,
  DeckStorageError,
} from "../../../src/decks/repository/index.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";

const catalog = catalogByCode(PROTOTYPE_CATALOG);

afterEach(async () => {
  vi.useRealTimers();
  await disposeTestDeckRepositories();
});

const repository = openTestDeckRepository;

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

describe("SQLite deck repository", () => {
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
    await repo.close();
  });

  it("keeps updatedAt monotonic when the system clock moves backward", async () => {
    const name = "deck-repo-monotonic-updated-at";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-03T00:00:00.000Z"));
    const repo = await openTestDeckRepository(name);
    const draft = createBlankDeck(
      "Clock rollback",
      catalog,
      PROTOTYPE_RULESET,
      {
        id: "clock-rollback",
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
    );
    const created = await repo.create(draft, emptyDeckHistory());
    expect(created.deck.updatedAt).toBe("2026-01-03T00:00:00.000Z");

    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    const saved = await repo.save(
      created.deck.revision,
      { ...created.deck, name: "Saved after rollback" },
      created.history,
    );

    expect(saved.deck.updatedAt).toBe(created.deck.updatedAt);
    await repo.close();
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
    await repo.close();
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
    await repo.close();
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
    await repo.close();
  });

  it("rejects malformed persisted rows before exposing them", async () => {
    const name = "deck-repo-malformed";
    const repo = await openTestDeckRepository(name);
    await repo.close();
    withTestDeckDatabase(name, (database) => {
      database.prepare("INSERT INTO user_records VALUES (?, ?, ?, ?)").run(
        "decks",
        "malformed",
        1,
        JSON.stringify({
          deck: {
            schemaVersion: 1,
            id: "malformed",
            revision: 1,
            name: "Malformed",
            main: [89631139],
            extra: [],
            side: [],
          },
          history: emptyDeckHistory(),
        }),
      );
    });
    const before = testDeckDatabaseBytes(name);
    const reopened = await openTestDeckRepository(name);
    await expect(reopened.list()).rejects.toBeInstanceOf(DeckStorageError);
    await expect(reopened.list()).rejects.toMatchObject({
      name: "DeckStorageError",
      message: "Unable to list decks",
      cause: { code: "USER_DATA_INVALID" },
    });
    await expect(reopened.load(deckId("malformed"))).rejects.toMatchObject({
      name: "DeckStorageError",
      message: "Unable to load deck",
      cause: { code: "USER_DATA_INVALID" },
    });
    expect(testDeckDatabaseBytes(name)).toEqual(before);
    await reopened.close();
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
    await first.close();

    const second = await openTestDeckRepository(name);
    const loaded = await second.load(draft.id);
    expect(loaded?.deck.validation.status).toBe("errors");
    expect(loaded?.history.undo).toHaveLength(50);
    await second.close();
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
    await repo.close();
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
    await repo.close();
  });

  /* SQLite fails closed on malformed payloads without repairing or deleting
     rows. The old IndexedDB skip behavior is deliberately retired. */
  it("rejects malformed autosave rows without changing any stored bytes", async () => {
    const name = "deck-repo-autosave-malformed";
    const repo = await repository(name);
    await repo.appendAutosave(autosave("valid", "2026-01-01T00:00:00.000Z"));
    await repo.close();

    withTestDeckDatabase(name, (database) => {
      database.prepare("INSERT INTO user_records VALUES (?, ?, ?, ?)").run(
        "deck-autosaves",
        "malformed",
        1,
        JSON.stringify({
          id: "malformed",
          deckId: "logged",
          createdAt: "2026-01-02T00:00:00.000Z",
        }),
      );
    });
    const before = testDeckDatabaseBytes(name);
    const reopened = await openTestDeckRepository(name);
    await expect(reopened.listAutosaves()).rejects.toBeInstanceOf(
      DeckStorageError,
    );
    await expect(reopened.listAutosaves()).rejects.toMatchObject({
      name: "DeckStorageError",
      message: "Unable to list autosave entries",
      cause: { code: "USER_DATA_INVALID" },
    });
    expect(testDeckDatabaseBytes(name)).toEqual(before);
    await reopened.close();
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
    await repo.close();
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
    await repo.close();
  });

  /* A row can outlive its deck when storage is edited outside the repository,
     so the read verifies the deck rather than trusting the preference. */
  it("reads a default naming a deck that is gone as none set", async () => {
    const name = "deck-repo-default-dangling";
    const repo = await repository(name);
    await repo.close();
    withTestDeckDatabase(name, (database) => {
      database
        .prepare("INSERT INTO user_records VALUES (?, ?, ?, ?)")
        .run("deck-meta", "defaultDeck", 1, JSON.stringify("vanished"));
    });
    const reopened = await openTestDeckRepository(name);
    expect(await reopened.getDefaultDeck()).toBeNull();
    await reopened.close();
  });

  it("setDefaultDeck refuses a missing deck", async () => {
    const repo = await repository("deck-repo-default-missing");
    await expect(repo.setDefaultDeck(deckId("absent"))).rejects.toBeInstanceOf(
      DeckStorageError,
    );
    expect(await repo.getDefaultDeck()).toBeNull();
    await repo.close();
  });
});

describe("removed favourite API", () => {
  it("exposes no favourite API", async () => {
    const repo = await repository("deck-repo-no-favourite-api");

    expect("listFavourites" in repo).toBe(false);
    expect("setFavourite" in repo).toBe(false);
    await repo.close();
  });
});
