import { readFileSync } from "node:fs";
import { setImmediate as nextTurn } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import {
  deckId,
  type DeckAutosaveRecord,
  type DeckHistory,
  type DeckRecord,
} from "../../../src/decks/deck-contracts.ts";
import { createSqliteDeckRepository } from "../../../src/decks/sqlite-deck-repository.ts";
import {
  DeckRevisionConflictError,
  DeckStorageError,
} from "../../../src/decks/deck-storage-errors.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import type { StoryBinding } from "../../../src/story/saves/generation-contracts.ts";
import { createSqliteStoryRepository } from "../../../src/story/saves/sqlite-story-repository.ts";
import { UserDataRuntime } from "../../fixtures/legacy-user-data-runtime.ts";
import type { UserDataStore } from "../../../src/storage/index.ts";
import {
  createUserDataFixture,
  type PackageFixtureDatabase,
} from "./sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
  type NodeFileStore,
} from "./runtime-fixtures.ts";

function runtime(fault?: (point: string) => void): {
  readonly database: PackageFixtureDatabase;
  readonly files: NodeFileStore;
  readonly store: UserDataRuntime;
} {
  const database = createUserDataFixture();
  const files = createNodeFileStore();
  return {
    database,
    files,
    store: new UserDataRuntime({
      database: databaseAdapter(database.database),
      files,
      randomId: () => crypto.randomUUID(),
      ...(fault === undefined ? {} : { fault }),
    }),
  };
}

function pauseNextDeckRead(store: UserDataStore) {
  const read = store.readUser.bind(store);
  let release!: () => void;
  let entered!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let paused = false;
  const reads = vi
    .spyOn(store, "readUser")
    .mockImplementation(async (namespace, key) => {
      const result = await read(namespace, key);
      if (namespace === "decks" && !paused) {
        paused = true;
        entered();
        await blocked;
      }
      return result;
    });
  return { reached, release, reads };
}

function metadataRows(fixture: ReturnType<typeof runtime>) {
  return fixture.database.database
    .prepare(
      "SELECT record_key, payload_json FROM user_records WHERE namespace='deck-meta' ORDER BY record_key",
    )
    .all();
}

const EMPTY_HISTORY: DeckHistory = Object.freeze({
  undo: Object.freeze([]),
  redo: Object.freeze([]),
  nextSequence: 1,
});

function history(idValue = "deck-1"): DeckHistory {
  return {
    undo: [
      {
        id: "update-1",
        deckId: deckId(idValue),
        sequence: 1,
        createdAt: "2026-09-24T00:00:00.000Z",
        before: { main: [], extra: [], side: [] },
        after: { main: [1], extra: [], side: [] },
        beforeImportedNeedsReview: false,
        afterImportedNeedsReview: false,
        beforeIllustrationCardCode: null,
        afterIllustrationCardCode: null,
        reason: "add",
      },
    ],
    redo: [],
    nextSequence: 2,
  };
}

function deck(idValue = "deck-1", revision = 0, name = "Fixture"): DeckRecord {
  const id = deckId(idValue);
  return {
    schemaVersion: 1,
    id,
    revision,
    name,
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    validation: { status: "valid", issues: [], rulesetRevision: "fixture" },
    importedNeedsReview: false,
    illustrationCardCode: null,
    main: [1],
    extra: [],
    side: [],
  };
}

function autosave(id = "autosave-1"): DeckAutosaveRecord {
  return {
    id,
    deckId: deckId("deck-1"),
    deckName: "Fixture",
    createdAt: "2026-09-24T00:00:00.000Z",
    main: [1],
    extra: [],
    side: [],
    illustrationCardCode: null,
  };
}

const CURRENT_STORY: StoryBinding = {
  chapterId: "chapter-01",
  contentId: "prototype-prologue-v1",
  revision: 1,
  completedChapterIds: [],
};

function removedReferenceEnvelope(slot: "manual:1" | "manual:2") {
  return {
    schemaVersion: 6 as const,
    slot,
    revision: 1,
    savedAt: 1_800_000_000_000,
    state: {
      ...createInitialStoryState(),
      narrativeIndex: 999,
      choice: "removed-choice",
      encounterId: "removed-opponent",
      locations: [
        { id: "removed-location", access: "available", completed: true },
      ],
    },
    story: {
      chapterId: "removed-chapter",
      contentId: "removed-content",
      revision: 97,
      completedChapterIds: ["removed-completed-chapter"],
    },
  };
}

describe("SQLite DeckRepository", () => {
  for (const pointer of ["lastOpened", "defaultDeck"] as const) {
    const setPointer = (
      repository: ReturnType<typeof createSqliteDeckRepository>,
    ) =>
      pointer === "lastOpened"
        ? repository.setLastOpened(deckId("deck-1"))
        : repository.setDefaultDeck(deckId("deck-1"));

    it(`${pointer}: queued delete cannot overtake a setter across repository instances`, async () => {
      const fixture = runtime();
      const setter = createSqliteDeckRepository(fixture.store);
      const deleter = createSqliteDeckRepository(fixture.store);
      await setter.create(deck(), EMPTY_HISTORY);
      await setter.appendAutosave(autosave());
      const gate = pauseNextDeckRead(fixture.store);
      const setting = setPointer(setter);
      await gate.reached;
      const deleting = deleter.delete(deckId("deck-1"), 1);
      let readsWhileBlocked: number;
      try {
        // Drain runnable work without waiting for the correctly queued delete.
        await nextTurn();
        readsWhileBlocked = gate.reads.mock.calls.length;
      } finally {
        gate.release();
      }
      await Promise.all([setting, deleting]);
      expect(metadataRows(fixture)).toEqual([]);
      expect(readsWhileBlocked).toBe(1);
      expect(await fixture.store.readUser("decks", "deck-1")).toEqual({
        kind: "ok",
        value: null,
      });
      expect(await deleter.listAutosaves()).toEqual([autosave()]);
    });

    it(`${pointer}: setter queued behind delete rejects the missing deck`, async () => {
      const fixture = runtime();
      const deleter = createSqliteDeckRepository(fixture.store);
      const setter = createSqliteDeckRepository(fixture.store);
      await deleter.create(deck(), EMPTY_HISTORY);
      const gate = pauseNextDeckRead(fixture.store);
      const deleting = deleter.delete(deckId("deck-1"), 1);
      await gate.reached;
      const setting = setPointer(setter);
      const results = Promise.allSettled([deleting, setting]);
      let readsWhileBlocked: number;
      try {
        await nextTurn();
        readsWhileBlocked = gate.reads.mock.calls.length;
      } finally {
        gate.release();
      }
      expect(await results).toEqual([
        { status: "fulfilled", value: undefined },
        {
          status: "rejected",
          reason: new DeckStorageError(
            pointer === "lastOpened"
              ? "Cannot open a missing deck"
              : "Cannot default a missing deck",
          ),
        },
      ]);
      expect(readsWhileBlocked).toBe(1);
      expect(metadataRows(fixture)).toEqual([]);
      expect(await fixture.store.readUser("decks", "deck-1")).toEqual({
        kind: "ok",
        value: null,
      });
    });
  }

  it("serializes createAndOpen with pointer writes across instances", async () => {
    const fixture = runtime();
    const creator = createSqliteDeckRepository(fixture.store);
    const setter = createSqliteDeckRepository(fixture.store);
    await creator.create(deck("deck-2"), EMPTY_HISTORY);
    const gate = pauseNextDeckRead(fixture.store);
    const creating = creator.createAndOpen(deck(), EMPTY_HISTORY);
    await gate.reached;
    const setting = setter.setLastOpened(deckId("deck-2"));
    let readsWhileBlocked: number;
    try {
      await nextTurn();
      readsWhileBlocked = gate.reads.mock.calls.length;
    } finally {
      gate.release();
    }
    await Promise.all([creating, setting]);
    expect(readsWhileBlocked).toBe(1);
    expect(metadataRows(fixture)).toEqual([
      { record_key: "lastOpened", payload_json: '"deck-2"' },
    ]);
    expect(await creator.load(deckId("deck-1"))).not.toBeNull();
  });

  it("keeps createAndOpen atomic and releases the shared queue after a failed write", async () => {
    let failCreate = true;
    const fixture = runtime((point) => {
      if (failCreate && point === "write-after-first")
        throw new Error("injected create failure");
    });
    const creator = createSqliteDeckRepository(fixture.store);
    const follower = createSqliteDeckRepository(fixture.store);
    const failing = creator.createAndOpen(deck(), EMPTY_HISTORY);
    const rejected = expect(failing).rejects.toBeInstanceOf(DeckStorageError);
    const following = follower.clearLastOpened();
    await rejected;
    await following;
    expect(metadataRows(fixture)).toEqual([]);
    expect(await follower.list()).toEqual([]);
    failCreate = false;
    const created = await follower.createAndOpen(deck(), EMPTY_HISTORY);
    expect(created.deck.revision).toBe(1);
    expect(metadataRows(fixture)).toEqual([
      { record_key: "lastOpened", payload_json: '"deck-1"' },
    ]);
  });

  it("keeps queued save CAS stale and lets a later mutation run", async () => {
    const fixture = runtime();
    const first = createSqliteDeckRepository(fixture.store);
    const second = createSqliteDeckRepository(fixture.store);
    const created = await first.create(deck(), EMPTY_HISTORY);
    const gate = pauseNextDeckRead(fixture.store);
    const saving = first.save(
      1,
      { ...created.deck, name: "First" },
      EMPTY_HISTORY,
    );
    await gate.reached;
    const stale = second.save(
      1,
      { ...created.deck, name: "Stale" },
      EMPTY_HISTORY,
    );
    const staleResult = expect(stale).rejects.toMatchObject({
      name: "DeckRevisionConflictError",
      actualRevision: 2,
    });
    let readsWhileBlocked: number;
    try {
      await nextTurn();
      readsWhileBlocked = gate.reads.mock.calls.length;
    } finally {
      gate.release();
    }
    await saving;
    await staleResult;
    expect(readsWhileBlocked).toBe(1);
    await second.setDefaultDeck(deckId("deck-1"));
    expect((await second.load(deckId("deck-1")))?.deck).toMatchObject({
      revision: 2,
      name: "First",
    });
  });

  it("queues pointer clears behind an in-flight setter across instances", async () => {
    const fixture = runtime();
    const setter = createSqliteDeckRepository(fixture.store);
    const clearer = createSqliteDeckRepository(fixture.store);
    await setter.createAndOpen(deck(), EMPTY_HISTORY);
    await setter.create(deck("deck-2"), EMPTY_HISTORY);
    const gate = pauseNextDeckRead(fixture.store);
    const setting = setter.setLastOpened(deckId("deck-2"));
    await gate.reached;
    const clearing = clearer.clearLastOpened(deckId("deck-1"));
    try {
      await nextTurn();
    } finally {
      gate.release();
    }
    await Promise.all([setting, clearing]);
    expect(metadataRows(fixture)).toEqual([
      { record_key: "lastOpened", payload_json: '"deck-2"' },
    ]);
    await clearer.clearLastOpened();
    const defaultSetting = setter.setDefaultDeck(deckId("deck-2"));
    const defaultClearing = clearer.setDefaultDeck(null);
    await Promise.all([defaultSetting, defaultClearing]);
    expect(metadataRows(fixture)).toEqual([]);
  });

  it("preserves CRUD, history, stale errors, pointer atomicity, and autosaves after deletion", async () => {
    const fixture = runtime();
    const repository = createSqliteDeckRepository(fixture.store);

    const storedHistory = history();
    const created = await repository.createAndOpen(deck(), storedHistory);
    expect(created.deck.revision).toBe(1);
    expect(await repository.getLastOpened()).toBe("deck-1");
    await repository.setDefaultDeck(deckId("deck-1"));
    await repository.appendAutosave(autosave());

    const saved = await repository.save(
      1,
      { ...created.deck, name: "Edited" },
      storedHistory,
    );
    expect(saved.deck).toMatchObject({ revision: 2, name: "Edited" });
    expect(saved.history).toEqual(storedHistory);
    expect(await repository.list()).toEqual([saved.deck]);
    expect(await repository.load(deckId("deck-1"))).toEqual(saved);

    await expect(
      repository.save(1, { ...saved.deck, name: "Stale" }, storedHistory),
    ).rejects.toMatchObject({
      name: "DeckRevisionConflictError",
      actualRevision: 2,
    });
    await expect(repository.delete(deckId("deck-1"), 1)).rejects.toBeInstanceOf(
      DeckRevisionConflictError,
    );

    await repository.delete(deckId("deck-1"), 2);
    expect(await repository.load(deckId("deck-1"))).toBeNull();
    expect(await repository.getLastOpened()).toBeNull();
    expect(await repository.getDefaultDeck()).toBeNull();
    expect(await repository.listAutosaves()).toEqual([autosave()]);
  });

  it("maps a deck CAS race from a real SQLite batch to the domain stale error", async () => {
    const fixture = runtime();
    const original = createSqliteDeckRepository(fixture.store);
    const storedHistory = history();
    const created = await original.create(deck(), storedHistory);
    let injected = false;
    const store: UserDataStore = {
      readUser: (namespace, key) => fixture.store.readUser(namespace, key),
      listUser: (namespace) => fixture.store.listUser(namespace),
      async writeUser(mutations) {
        if (!injected && mutations[0]?.namespace === "decks") {
          injected = true;
          await fixture.store.writeUser([
            {
              kind: "put",
              namespace: "decks",
              key: "deck-1",
              expectedRevision: 1,
              payload: {
                deck: { ...created.deck, name: "External", revision: 2 },
                history: storedHistory,
              },
            },
          ]);
        }
        return fixture.store.writeUser(mutations);
      },
      exportUserData: () => fixture.store.exportUserData(),
      inspectUserDataBackup: (file) =>
        fixture.store.inspectUserDataBackup(file),
      restoreUserData: (token, revision, confirmed) =>
        fixture.store.restoreUserData(token, revision, confirmed),
    };
    const racing = createSqliteDeckRepository(store);
    await expect(
      racing.save(1, { ...created.deck, name: "Local" }, storedHistory),
    ).rejects.toMatchObject({
      name: "DeckRevisionConflictError",
      actualRevision: 2,
    });
  });

  it("rolls back deck, default, and last-opened deletion as one SQLite batch", async () => {
    let failDelete = false;
    const fixture = runtime((point) => {
      if (failDelete && point === "write-after-first")
        throw new Error("injected delete failure");
    });
    const repository = createSqliteDeckRepository(fixture.store);
    await repository.createAndOpen(deck(), EMPTY_HISTORY);
    await repository.setDefaultDeck(deckId("deck-1"));

    failDelete = true;
    await expect(repository.delete(deckId("deck-1"), 1)).rejects.toBeInstanceOf(
      DeckStorageError,
    );
    failDelete = false;
    expect(await repository.load(deckId("deck-1"))).not.toBeNull();
    expect(await repository.getLastOpened()).toBe("deck-1");
    expect(await repository.getDefaultDeck()).toBe("deck-1");
  });

  it("trims the global autosave log to the newest 100 entries", async () => {
    const fixture = runtime();
    const repository = createSqliteDeckRepository(fixture.store);
    const second = createSqliteDeckRepository(fixture.store);
    await Promise.all(
      Array.from({ length: 101 }, (_, index) =>
        (index % 2 === 0 ? repository : second).appendAutosave({
          ...autosave(`autosave-${String(index).padStart(3, "0")}`),
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        }),
      ),
    );
    const records = await repository.listAutosaves();
    expect(records).toHaveLength(100);
    expect(records[0]?.id).toBe("autosave-100");
    expect(records.at(-1)?.id).toBe("autosave-001");
  });

  it("rejects domain-invalid deck/history input before writing", async () => {
    const fixture = runtime();
    const repository = createSqliteDeckRepository(fixture.store);
    const invalidHistory: DeckHistory = {
      undo: [
        {
          id: "update-1",
          deckId: deckId("another-deck"),
          sequence: 1,
          createdAt: "2026-09-24T00:00:00.000Z",
          before: { main: [], extra: [], side: [] },
          after: { main: [1], extra: [], side: [] },
          beforeImportedNeedsReview: false,
          afterImportedNeedsReview: false,
          beforeIllustrationCardCode: null,
          afterIllustrationCardCode: null,
          reason: "add",
        },
      ],
      redo: [],
      nextSequence: 2,
    };
    await expect(repository.create(deck(), invalidHistory)).rejects.toThrow(
      "Stored deck history is invalid",
    );
    expect(await fixture.store.listUser("decks")).toEqual({
      kind: "ok",
      value: [],
    });
  });
});

describe("SQLite GenerationSaveRepository", () => {
  it("writes, reads, lists, clears, and reports stale schema6 revisions", async () => {
    const fixture = runtime();
    const repository = createSqliteStoryRepository(fixture.store);
    const state = createInitialStoryState();

    expect(
      await repository.write("manual:1", state, null, CURRENT_STORY),
    ).toEqual({ kind: "written", revision: 1 });
    expect(await repository.read("manual:1")).toMatchObject({
      kind: "ready",
      envelope: { revision: 1, story: CURRENT_STORY },
    });
    expect(await repository.list()).toMatchObject([
      { slot: "manual:1", revision: 1 },
    ]);

    expect(await repository.write("manual:1", state, 0, CURRENT_STORY)).toEqual(
      {
        kind: "stale",
        currentRevision: 1,
      },
    );
    await repository.clear("manual:1");
    expect(await repository.read("manual:1")).toEqual({
      kind: "empty",
      slot: "manual:1",
    });
  });

  it("preserves structurally valid removed refs and reports them unsupported without casts", async () => {
    const fixture = runtime();
    const repository = createSqliteStoryRepository(fixture.store);
    const oldOne = removedReferenceEnvelope("manual:1");
    const oldTwo = removedReferenceEnvelope("manual:2");
    expect(
      await fixture.store.writeUser([
        {
          kind: "put",
          namespace: "story",
          key: "manual:1",
          expectedRevision: null,
          payload: oldOne,
        },
        {
          kind: "put",
          namespace: "story",
          key: "manual:2",
          expectedRevision: null,
          payload: oldTwo,
        },
      ]),
    ).toMatchObject({ kind: "ok" });

    expect(await repository.read("manual:1")).toEqual({
      kind: "incompatible",
      slot: "manual:1",
      found: 6,
    });
    const before = await fixture.store.readUser("story", "manual:2");
    expect(
      await repository.write(
        "manual:1",
        createInitialStoryState(),
        1,
        CURRENT_STORY,
      ),
    ).toEqual({ kind: "written", revision: 2 });
    expect(await fixture.store.readUser("story", "manual:2")).toEqual(before);
    expect(await fixture.store.readUser("story", "manual:1")).toMatchObject({
      kind: "ok",
      value: {
        revision: 2,
        payload: { revision: 2, story: CURRENT_STORY },
      },
    });
  });

  it("maps a story CAS race from a real SQLite batch to stale", async () => {
    const fixture = runtime();
    const original = createSqliteStoryRepository(fixture.store);
    const state = createInitialStoryState();
    expect(
      await original.write("manual:1", state, null, CURRENT_STORY),
    ).toEqual({
      kind: "written",
      revision: 1,
    });
    let injected = false;
    const store: UserDataStore = {
      readUser: (namespace, key) => fixture.store.readUser(namespace, key),
      listUser: (namespace) => fixture.store.listUser(namespace),
      async writeUser(mutations) {
        if (!injected && mutations[0]?.namespace === "story") {
          injected = true;
          const current = await fixture.store.readUser("story", "manual:1");
          if (current.kind === "ok" && current.value !== null)
            await fixture.store.writeUser([
              {
                kind: "put",
                namespace: "story",
                key: "manual:1",
                expectedRevision: 1,
                payload: {
                  ...(current.value.payload as object),
                  revision: 2,
                  savedAt: 1_900_000_000_000,
                },
              },
            ]);
        }
        return fixture.store.writeUser(mutations);
      },
      exportUserData: () => fixture.store.exportUserData(),
      inspectUserDataBackup: (file) =>
        fixture.store.inspectUserDataBackup(file),
      restoreUserData: (token, revision, confirmed) =>
        fixture.store.restoreUserData(token, revision, confirmed),
    };
    const racing = createSqliteStoryRepository(store);
    expect(await racing.write("manual:1", state, 1, CURRENT_STORY)).toEqual({
      kind: "stale",
      currentRevision: 2,
    });
  });

  it("surfaces closed-backend failures through existing repository contracts", async () => {
    const fixture = runtime();
    const decks = createSqliteDeckRepository(fixture.store);
    const story = createSqliteStoryRepository(fixture.store);
    await fixture.store.close();

    await expect(decks.list()).rejects.toBeInstanceOf(DeckStorageError);
    expect(
      await story.write(
        "manual:1",
        createInitialStoryState(),
        null,
        CURRENT_STORY,
      ),
    ).toEqual({ kind: "failed", reason: "unavailable" });
    await expect(story.clear("manual:1")).rejects.toThrow(
      "STORAGE_UNAVAILABLE",
    );
  });

  it("contains no legacy storage or Worker construction path", () => {
    for (const file of [
      "src/decks/sqlite-deck-repository.ts",
      "src/story/saves/sqlite-story-repository.ts",
      "src/shell/adapters/sqlite-user-services.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(
        /IndexedDbDeckRepository|localStorage|new Worker/,
      );
    }
  });
});
