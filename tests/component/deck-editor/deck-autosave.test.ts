// @vitest-environment node

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import {
  IndexedDbDeckRepository,
  type DeckRepository,
} from "../../../src/decks/repository/index.ts";
import {
  createBlankDeck,
  emptyDeckHistory,
} from "../../../src/decks/editing/index.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/validation/index.ts";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";
import type {
  DeckAutosaveRecord,
  DeckId,
  StoredDeck,
} from "../../../src/decks/contracts/index.ts";

const names: string[] = [];
afterEach(async () =>
  Promise.all(names.splice(0).map((name) => deleteDB(name))),
);

/* Autosave appends are deliberately not awaited by the controller — a slow or
   failing log must never hold up a deck save — so a test that wants to read the
   log has to wait for the write it is about rather than assume it landed. */
async function autosavesReaching(
  repository: DeckRepository,
  count: number,
): Promise<readonly DeckAutosaveRecord[]> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const entries = await repository.listAutosaves();
    if (entries.length >= count) return entries;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`The autosave log never reached ${String(count)} entries`);
}

const NO_AUTOSAVE_LOG = {
  appendAutosave: async () => undefined,
  listAutosaves: async () => [],
} satisfies Pick<DeckRepository, "appendAutosave" | "listAutosaves">;

/* None of these cases is about the default deck, so every fake answers the
   preference the way a fresh database does. */
const NO_DEFAULT_DECK = {
  getDefaultDeck: async () => null,
  setDefaultDeck: async () => undefined,
} satisfies Pick<DeckRepository, "getDefaultDeck" | "setDefaultDeck">;

describe("deck autosave controller", () => {
  it("keeps local edits visible after failure then retries autosave", async () => {
    let stored: StoredDeck | null = null;
    let lastOpened: DeckId | null = null;
    let failNextSave = true;
    const repository: DeckRepository = {
      list: async () => (stored === null ? [] : [stored.deck]),
      load: async () => stored,
      create: async (deck, history) => {
        stored = { deck: { ...deck, revision: 1 }, history };
        return stored;
      },
      createAndOpen: async (deck, history) => {
        stored = { deck: { ...deck, revision: 1 }, history };
        lastOpened = deck.id;
        return stored;
      },
      save: async (expectedRevision, deck, history) => {
        if (failNextSave) {
          failNextSave = false;
          throw new Error("quota simulation");
        }
        stored = {
          deck: { ...deck, revision: expectedRevision + 1 },
          history,
        };
        return stored;
      },
      delete: async () => undefined,
      getLastOpened: async () => lastOpened,
      setLastOpened: async (id) => {
        lastOpened = id;
      },
      clearLastOpened: async () => {
        lastOpened = null;
      },
      ...NO_AUTOSAVE_LOG,
      ...NO_DEFAULT_DECK,
    };
    const controller = new DeckBuilderController(
      repository,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Retry");
    await controller.mutate({ type: "add", cardCode: 89631139 });
    expect(get(controller).saveState).toBe("failed");
    expect(get(controller).current?.deck.main).toEqual([89631139]);
    await controller.showLibrary();
    expect(get(controller).mode).toBe("editor");
    expect(get(controller).message).toContain("Resolve unsaved deck changes");
    await controller.openDeck(lastOpened!);
    expect(get(controller).saveState).toBe("failed");
    expect(get(controller).current?.deck.main).toEqual([89631139]);
    await controller.retrySave();
    expect(get(controller).saveState).toBe("saved");
    expect((await repository.load(lastOpened!))?.deck.main).toEqual([89631139]);
  });

  it("waits for pending saves before another deck opens", async () => {
    let resolveDeferredSave!: (value: StoredDeck) => void;
    const deferredSave = new Promise<StoredDeck>((resolve) => {
      resolveDeferredSave = resolve;
    });
    const catalog = catalogByCode(PROTOTYPE_CATALOG);
    const first = {
      deck: {
        ...createBlankDeck("First", catalog, PROTOTYPE_RULESET, {
          id: "first",
        }),
        revision: 1,
      },
      history: emptyDeckHistory(),
    } satisfies StoredDeck;
    const second = {
      deck: {
        ...createBlankDeck("Second", catalog, PROTOTYPE_RULESET, {
          id: "second",
        }),
        revision: 1,
      },
      history: emptyDeckHistory(),
    } satisfies StoredDeck;
    const values = new Map<DeckId, StoredDeck>([
      [first.deck.id, first],
      [second.deck.id, second],
    ]);
    const repository: DeckRepository = {
      list: async () => [...values.values()].map(({ deck }) => deck),
      load: async (id) => values.get(id) ?? null,
      create: async (deck, history) => ({ deck, history }),
      createAndOpen: async (deck, history) => ({ deck, history }),
      save: async (expectedRevision, deck, history) => {
        const value = await deferredSave;
        values.set(value.deck.id, value);
        void expectedRevision;
        void deck;
        void history;
        return value;
      },
      delete: async () => undefined,
      getLastOpened: async () => first.deck.id,
      setLastOpened: async () => undefined,
      clearLastOpened: async () => undefined,
      ...NO_AUTOSAVE_LOG,
      ...NO_DEFAULT_DECK,
    };
    const controller = new DeckBuilderController(
      repository,
      catalog,
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    const save = controller.mutate({ type: "add", cardCode: 89631139 });
    await Promise.resolve();
    const opening = controller.openDeck(second.deck.id);
    await Promise.resolve();
    expect(get(controller).current?.deck.id).toBe(first.deck.id);
    resolveDeferredSave({
      deck: { ...first.deck, main: [89631139], revision: 2 },
      history: first.history,
    });
    await save;
    await opening;
    expect(get(controller).current?.deck.id).toBe(second.deck.id);
  });

  it("refuses navigation after an in-flight save fails, retaining retry and draft", async () => {
    const name = "controller-navigation-failure";
    names.push(name);
    const repository = await IndexedDbDeckRepository.open(name);
    try {
      const controller = new DeckBuilderController(
        repository,
        catalogByCode(PROTOTYPE_CATALOG),
        PROTOTYPE_RULESET,
      );
      await controller.initialize();
      await controller.createDeck("Other");
      const other = get(controller).current!.deck.id;
      await controller.createDeck("Draft");
      const current = get(controller).current!.deck.id;
      const pending = Promise.withResolvers<StoredDeck>();
      const saving = vi
        .spyOn(repository, "save")
        .mockReturnValueOnce(pending.promise);
      const edit = controller.mutate({ type: "add", cardCode: 89631139 });
      const navigation = controller.openDeck(other);
      await Promise.resolve();
      expect(get(controller).current?.deck.id).toBe(current);
      pending.reject(new Error("quota simulation"));
      await edit;
      expect(await navigation).toBe(false);
      expect(get(controller).saveState).toBe("failed");
      expect(get(controller).current?.deck.main).toEqual([89631139]);
      await controller.duplicate(other);
      expect(await controller.createDeck("No discard")).toBe(false);
      expect(
        await controller.importDeck("No discard", {
          main: [],
          extra: [],
          side: [],
        }),
      ).toBe(false);
      expect(get(controller).current?.deck.id).toBe(current);
      expect(saving).toHaveBeenCalledOnce();
      await controller.retrySave();
      expect(get(controller).saveState).toBe("saved");
      expect((await repository.load(current))?.deck.main).toEqual([89631139]);
    } finally {
      repository.close();
    }
  });

  it.each([
    ["create", false],
    ["import", false],
    ["duplicate", false],
    ["create", true],
    ["import", true],
    ["duplicate", true],
  ] as const)(
    "orders %s after a pending save (failure=%s), before later navigation",
    async (operation, failure) => {
      const name = `controller-save-before-${operation}-${failure}`;
      names.push(name);
      const repository = await IndexedDbDeckRepository.open(name);
      const controller = new DeckBuilderController(
        repository,
        catalogByCode(PROTOTYPE_CATALOG),
        PROTOTYPE_RULESET,
      );
      await controller.initialize();
      await controller.createDeck("Original");
      const original = get(controller).current!.deck.id;
      const gate = Promise.withResolvers<void>();
      const save = repository.save.bind(repository);
      const saving = vi
        .spyOn(repository, "save")
        .mockImplementationOnce(async (...args) => {
          await gate.promise;
          if (failure) throw new Error("quota simulation");
          return save(...args);
        });
      const edit = controller.mutate({ type: "add", cardCode: 46986414 });
      await vi.waitFor(() => expect(saving).toHaveBeenCalledOnce());
      const creating = vi.spyOn(repository, "createAndOpen");
      const transition =
        operation === "create"
          ? controller.createDeck("Created")
          : operation === "import"
            ? controller.importDeck("Imported", {
                main: [89631139],
                extra: [],
                side: [],
              })
            : controller.duplicate(original);
      const navigation = controller.openDeck(original);
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(creating).not.toHaveBeenCalled();
        expect(get(controller).saveState).toBe("saving");
        gate.resolve();
        const [, created, navigated] = await Promise.all([
          edit,
          transition,
          navigation,
        ]);
        expect(creating).toHaveBeenCalledTimes(failure ? 0 : 1);
        if (operation !== "duplicate") expect(created).toBe(!failure);
        expect(navigated).toBe(!failure);
        expect(get(controller).current?.deck.id).toBe(original);
        expect(get(controller).current?.deck.main).toEqual([46986414]);
        expect(get(controller).saveState).toBe(failure ? "failed" : "saved");
        if (failure) await controller.retrySave();
        expect((await repository.load(original))?.deck.main).toEqual([
          46986414,
        ]);
      } finally {
        gate.resolve();
        await Promise.all([edit, transition, navigation]);
        repository.close();
      }
    },
  );

  it.each(["create", "import", "duplicate"] as const)(
    "serializes pending %s before edits and leave checks",
    async (operation) => {
      const name = `controller-pending-${operation}`;
      names.push(name);
      const repository = await IndexedDbDeckRepository.open(name);
      const controller = new DeckBuilderController(
        repository,
        catalogByCode(PROTOTYPE_CATALOG),
        PROTOTYPE_RULESET,
      );
      await controller.initialize();
      await controller.createDeck("Original");
      const original = get(controller).current!.deck.id;
      const gate = Promise.withResolvers<void>();
      const createAndOpen = repository.createAndOpen.bind(repository);
      const creating = vi
        .spyOn(repository, "createAndOpen")
        .mockImplementationOnce(async (deck, history) => {
          await gate.promise;
          return createAndOpen(deck, history);
        });
      const saving = vi
        .spyOn(repository, "save")
        .mockRejectedValue(new Error("quota simulation"));
      const transition =
        operation === "create"
          ? controller.createDeck("Created")
          : operation === "import"
            ? controller.importDeck("Imported", {
                main: [89631139],
                extra: [],
                side: [],
              })
            : controller.duplicate(original);
      await vi.waitFor(() => expect(creating).toHaveBeenCalledOnce());
      const edit = controller.mutate({ type: "add", cardCode: 46986414 });
      const leave = vi.fn();
      const leaving = controller.canLeave().then(leave);
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(saving).not.toHaveBeenCalled();
        expect(leave).not.toHaveBeenCalled();
      } finally {
        gate.resolve();
        await Promise.all([transition, edit, leaving]);
        repository.close();
      }
      expect(await edit).toBe(false);
      expect(leave).toHaveBeenCalledWith(true);
      expect(get(controller).current?.deck.id).not.toBe(original);
      expect(get(controller).saveState).toBe("saved");
    },
  );

  it("order-only autosave restore persists undo and redo snapshots", async () => {
    const name = "controller-order-restore";
    names.push(name);
    const repository = await IndexedDbDeckRepository.open(name);
    try {
      const controller = new DeckBuilderController(
        repository,
        catalogByCode(PROTOTYPE_CATALOG),
        PROTOTYPE_RULESET,
      );
      await controller.initialize();
      await controller.createDeck("Ordered");
      await controller.mutate({ type: "add", cardCode: 89631139 });
      await controller.mutate({ type: "add", cardCode: 46986414 });
      const deck = get(controller).current!.deck;
      await controller.restoreAutosave({
        id: "order",
        deckId: deck.id,
        deckName: deck.name,
        createdAt: deck.updatedAt,
        main: [46986414, 89631139],
        extra: [],
        side: [],
      });
      expect(get(controller).current?.history.undo.at(-1)?.reason).toBe(
        "restore",
      );
      await controller.undo();
      expect(get(controller).current?.deck.main).toEqual([89631139, 46986414]);
      await controller.redo();
      expect((await repository.load(deck.id))?.deck.main).toEqual([
        46986414, 89631139,
      ]);
    } finally {
      repository.close();
    }
  });

  it("recovers a committed create inside the queue without deadlocking later navigation", async () => {
    const name = "controller-create-refresh-failure";
    names.push(name);
    const repository = await IndexedDbDeckRepository.open(name);
    try {
      const controller = new DeckBuilderController(
        repository,
        catalogByCode(PROTOTYPE_CATALOG),
        PROTOTYPE_RULESET,
      );
      await controller.initialize();
      vi.spyOn(repository, "list").mockRejectedValueOnce(
        new Error("list unavailable"),
      );
      await expect(controller.createDeck("Committed")).resolves.toBe(true);
      expect(get(controller).current?.deck.name).toBe("Committed");
      await expect(controller.showLibrary()).resolves.toBe(true);
      expect(get(controller).mode).toBe("library");
      await expect(controller.createDeck("Next")).resolves.toBe(true);
      expect(get(controller).current?.deck.name).toBe("Next");
    } finally {
      repository.close();
    }
  });

  it("does not offer duplicate import retry after post-commit refresh failure", async () => {
    let stored: StoredDeck | null = null;
    let failList = false;
    let creates = 0;
    const repository: DeckRepository = {
      list: async () => {
        if (failList) throw new Error("list unavailable");
        return stored === null ? [] : [stored.deck];
      },
      load: async () => stored,
      create: async (deck, history) => ({ deck, history }),
      createAndOpen: async (deck, history) => {
        creates += 1;
        stored = { deck: { ...deck, revision: 1 }, history };
        failList = true;
        return stored;
      },
      save: async (_expectedRevision, deck, history) => ({ deck, history }),
      delete: async () => undefined,
      getLastOpened: async () => null,
      setLastOpened: async () => undefined,
      clearLastOpened: async () => undefined,
      ...NO_AUTOSAVE_LOG,
      ...NO_DEFAULT_DECK,
    };
    const controller = new DeckBuilderController(
      repository,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await expect(
      controller.importDeck("Committed import", {
        main: [99999999],
        extra: [],
        side: [],
      }),
    ).resolves.toBe(true);
    expect(creates).toBe(1);
    expect(get(controller).current?.deck.name).toBe("Committed import");
    expect(get(controller).message).toContain("library refresh failed");
  });

  it("revalidates loaded decks when the pinned ruleset changes", async () => {
    const name = "controller-revalidation";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const catalog = catalogByCode(PROTOTYPE_CATALOG);
    const first = new DeckBuilderController(repo, catalog, PROTOTYPE_RULESET);
    await first.initialize();
    await first.createDeck("Ruleset revision");
    const changedRuleset = {
      ...PROTOTYPE_RULESET,
      revision: `${PROTOTYPE_RULESET.revision}-changed`,
    };
    const second = new DeckBuilderController(repo, catalog, changedRuleset);
    await second.initialize();
    expect(
      get(second).current?.deck.validation.issues.some(
        ({ code }) => code === "ruleset-changed",
      ),
    ).toBe(true);
    repo.close();
  });

  it("autosaves invalid mutations and restores them after reload", async () => {
    const name = "controller-autosave";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Autosave");
    await controller.mutate({ type: "add", cardCode: 89631139 });
    const saved = get(controller);
    expect(saved.saveState).toBe("saved");
    expect(saved.current?.deck.main).toEqual([89631139]);
    expect(saved.current?.deck.validation.status).toBe("errors");
    const id = saved.current!.deck.id;
    repo.close();

    const reopened = await IndexedDbDeckRepository.open(name);
    expect((await reopened.load(id))?.deck.main).toEqual([89631139]);
    reopened.close();
  });

  it("each membership edit appends an autosave entry", async () => {
    const name = "controller-autosave-log";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Logged");
    await controller.mutate({ type: "add", cardCode: 89631139 });
    await controller.mutate({ type: "add", cardCode: 46986414 });

    const entries = await autosavesReaching(repo, 2);
    expect(entries).toHaveLength(2);
    expect(entries.every(({ deckName }) => deckName === "Logged")).toBe(true);
    /* Both edits are recorded, each with the cards the deck held at the time.
       Compared as a set: two entries written inside one millisecond share a
       timestamp, so their relative order is not defined. */
    expect(entries.map(({ main }) => main.length).sort()).toEqual([1, 2]);
    repo.close();
  });

  it("a reorder appends an autosave entry", async () => {
    const name = "controller-autosave-reorder";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Positional");
    await controller.mutate({ type: "add", cardCode: 89631139 });
    await controller.mutate({ type: "add", cardCode: 46986414 });

    await controller.mutate({ type: "reorder", zone: "main", from: 0, to: 1 });
    const entries = await autosavesReaching(repo, 3);

    const reorderedMain = get(controller).current?.deck.main;
    expect(entries).toHaveLength(3);
    expect(entries.map(({ main }) => main)).toContainEqual(reorderedMain);
    repo.close();
  });

  it("a sort appends one autosave and one undoable history entry", async () => {
    const name = "controller-autosave-sort";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Sorted");
    await controller.mutate({ type: "add", cardCode: 46986414 });
    await controller.mutate({ type: "add", cardCode: 89631139 });
    const unsorted = [46986414, 89631139];
    const undoLengthBefore = get(controller).current!.history.undo.length;

    await controller.mutate({
      type: "sort",
      mode: "alpha",
      direction: "asc",
    });
    const entries = await autosavesReaching(repo, 3);

    expect(entries).toHaveLength(3);
    expect(get(controller).current?.history.undo).toHaveLength(
      undoLengthBefore + 1,
    );
    expect(get(controller).current?.deck.main).toEqual([89631139, 46986414]);
    await controller.undo();
    expect(get(controller).current?.deck.main).toEqual(unsorted);
    await controller.redo();
    expect(get(controller).current?.deck.main).toEqual([89631139, 46986414]);
    repo.close();
  });

  it("an already-satisfied selected sort and direction toggle each add one undo entry", async () => {
    const name = "controller-sort-forced-history";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Already sorted");
    await controller.mutate({ type: "add", cardCode: 89631139 });
    const undoLengthBefore = get(controller).current!.history.undo.length;

    await controller.mutate({
      type: "sort",
      mode: "alpha",
      direction: "asc",
    });
    expect(get(controller).current?.history.undo).toHaveLength(
      undoLengthBefore + 1,
    );

    await controller.mutate({
      type: "sort",
      mode: "alpha",
      direction: "desc",
    });
    expect(get(controller).current?.history.undo).toHaveLength(
      undoLengthBefore + 2,
    );
    expect(
      get(controller)
        .current?.history.undo.slice(-2)
        .map(({ reason }) => reason),
    ).toEqual(["sort", "sort"]);
    expect(await autosavesReaching(repo, 3)).toHaveLength(3);
    repo.close();
  });

  it("reloads persisted sort history for exact undo and redo", async () => {
    const name = "controller-sort-history-reload";
    names.push(name);
    const catalog = catalogByCode(PROTOTYPE_CATALOG);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalog,
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Persisted sort");
    await controller.mutate({ type: "add", cardCode: 46986414 });
    await controller.mutate({ type: "add", cardCode: 89631139 });
    const unsorted = [46986414, 89631139];
    const sorted = [89631139, 46986414];
    await controller.mutate({
      type: "sort",
      mode: "alpha",
      direction: "asc",
    });
    repo.close();

    const reopenedRepo = await IndexedDbDeckRepository.open(name);
    const reopened = new DeckBuilderController(
      reopenedRepo,
      catalog,
      PROTOTYPE_RULESET,
    );
    await reopened.initialize();
    expect(get(reopened).current?.deck.main).toEqual(sorted);
    expect(get(reopened).current?.history.undo.at(-1)?.reason).toBe("sort");

    await reopened.undo();
    expect(get(reopened).current?.deck.main).toEqual(unsorted);
    await reopened.redo();
    expect(get(reopened).current?.deck.main).toEqual(sorted);
    reopenedRepo.close();
  });

  it("a reorder is still not undoable", async () => {
    const name = "controller-autosave-not-undoable";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Undoable");
    await controller.mutate({ type: "add", cardCode: 89631139 });
    await controller.mutate({ type: "add", cardCode: 46986414 });
    const undoLengthBefore = get(controller).current?.history.undo.length ?? 0;

    await controller.mutate({ type: "reorder", zone: "main", from: 0, to: 1 });

    expect(get(controller).current?.history.undo.length).toBe(undoLengthBefore);
    await controller.undo();
    expect(get(controller).current?.deck.main).not.toEqual([
      89631139, 46986414,
    ]);
    repo.close();
  });
});
