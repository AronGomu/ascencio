// @vitest-environment node

import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import { MAXIMUM_DECK_AUTOSAVES } from "../../../src/decks/deck-database.ts";
import type {
  DeckAutosaveRecord,
  DeckHistory,
} from "../../../src/decks/deck-contracts.ts";
import { deckId } from "../../../src/decks/deck-contracts.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import {
  DeckRevisionConflictError,
  DeckStorageError,
} from "../../../src/decks/indexeddb-deck-repository.ts";
import { createStoryDeckRepository } from "../../../src/story/decks/story-deck-repository.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import { createStorySaveRepository } from "../../../src/story/saves/story-save-repository.ts";
import { storyDeckFixture as storyDeck } from "../../fixtures/story-decks.ts";

/* The adapter is the only thing standing between the deck editor and a
   player's save, so these tests drive the whole `DeckRepository` surface
   against a real reducer rather than a stubbed one: the T18 commands answer an
   id they cannot resolve by changing nothing, and a repository that reported
   success anyway would look exactly like a save that worked. */

const NOW = new Date("2026-09-01T12:00:00.000Z");

function harness(overrides: Partial<StoryState> = {}) {
  let state: StoryState = { ...createInitialStoryState(), ...overrides };
  const persisted: StoryState[] = [];
  const repository = createStoryDeckRepository({
    readState: () => state,
    dispatch: (command) => {
      state = reduceStory(state, command);
    },
    persist: async () => {
      persisted.push(state);
    },
    now: () => NOW,
  });
  return {
    repository,
    persisted,
    get state(): StoryState {
      return state;
    },
  };
}

function autosave(id: string, deck: string): DeckAutosaveRecord {
  return {
    id,
    deckId: deckId(deck),
    deckName: `Deck ${deck}`,
    createdAt: "2026-08-20T00:00:00.000Z",
    main: [89631139],
    extra: [],
    side: [],
  };
}

const history: DeckHistory = emptyDeckHistory();

describe("story deck repository", () => {
  it("list returns the save's decks, in state order", async () => {
    const { repository } = harness({
      decks: [storyDeck("alpha"), storyDeck("beta")],
    });
    expect((await repository.list()).map(({ id }) => id)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("load returns the deck with its session history, or null", async () => {
    const { repository } = harness({ decks: [storyDeck("alpha")] });
    const stored = await repository.load(deckId("alpha"));
    expect(stored?.deck.id).toBe("alpha");
    expect(stored?.history).toEqual(emptyDeckHistory());
    expect(await repository.load(deckId("ghost"))).toBeNull();
  });

  it("create adds a deck and returns it stored", async () => {
    const context = harness({
      decks: [storyDeck("alpha"), storyDeck("beta")],
    });
    const stored = await context.repository.create(storyDeck("gamma"), history);

    expect(stored.deck.revision).toBe(1);
    expect(stored.deck.updatedAt).toBe(NOW.toISOString());
    expect(stored.history).toEqual(history);
    expect((await context.repository.list()).map(({ id }) => id)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
    expect(context.persisted).toHaveLength(1);
    expect(context.persisted[0]!.decks).toHaveLength(3);
  });

  it("createAndOpen also becomes the last-opened deck", async () => {
    const context = harness();
    await context.repository.createAndOpen(storyDeck("alpha"), history);
    expect(await context.repository.getLastOpened()).toBe("alpha");
  });

  /* The reducer refuses a duplicate id rather than replacing the deck already
     under it. A repository that dispatched anyway would report a create that
     never happened. */
  it("create refuses an id the save already holds", async () => {
    const context = harness({ decks: [storyDeck("alpha")] });
    await expect(
      context.repository.create(
        storyDeck("alpha", { name: "Impostor" }),
        history,
      ),
    ).rejects.toBeInstanceOf(DeckRevisionConflictError);
    expect(context.state.decks.map(({ name }) => name)).toEqual(["Deck alpha"]);
    expect(context.persisted).toEqual([]);
  });

  it("save persists through the story save path and bumps the revision", async () => {
    const context = harness({ decks: [storyDeck("alpha", { revision: 4 })] });
    const stored = await context.repository.save(
      4,
      storyDeck("alpha", { revision: 4, name: "Renamed" }),
      history,
    );

    expect(stored.deck.revision).toBe(5);
    expect(stored.deck.name).toBe("Renamed");
    expect(stored.deck.updatedAt).toBe(NOW.toISOString());
    expect(context.persisted).toHaveLength(1);
    expect(context.persisted[0]!.decks[0]).toEqual(stored.deck);
  });

  it("save rejects a stale revision and writes nothing", async () => {
    const context = harness({ decks: [storyDeck("alpha", { revision: 4 })] });
    await expect(
      context.repository.save(
        3,
        storyDeck("alpha", { revision: 3, name: "Stale" }),
        history,
      ),
    ).rejects.toMatchObject({
      name: "DeckRevisionConflictError",
      actualRevision: 4,
    });
    expect(context.state.decks[0]!.name).toBe("Deck alpha");
    expect(context.persisted).toEqual([]);
  });

  /* An editor holding a deck this save no longer has: deleted in another tab,
     or a draft from a save that was loaded over. `deck-save` refuses to append
     it, so the repository has to refuse first. */
  it("save rejects a deck the save does not hold", async () => {
    const context = harness();
    await expect(
      context.repository.save(1, storyDeck("ghost"), history),
    ).rejects.toMatchObject({
      name: "DeckRevisionConflictError",
      actualRevision: null,
    });
    expect(context.persisted).toEqual([]);
  });

  it("delete removes the deck", async () => {
    const context = harness({
      decks: [storyDeck("alpha"), storyDeck("beta")],
    });
    await context.repository.delete(deckId("alpha"), 1);
    expect((await context.repository.list()).map(({ id }) => id)).toEqual([
      "beta",
    ]);
    expect(await context.repository.load(deckId("alpha"))).toBeNull();
    expect(context.persisted).toHaveLength(1);
  });

  it("delete clears a default that pointed at the deck", async () => {
    const context = harness({
      decks: [storyDeck("alpha")],
      defaultDeckId: "alpha",
    });
    await context.repository.delete(deckId("alpha"), 1);
    expect(await context.repository.getDefaultDeck()).toBeNull();
  });

  it("delete rejects a stale revision", async () => {
    const context = harness({ decks: [storyDeck("alpha", { revision: 4 })] });
    await expect(
      context.repository.delete(deckId("alpha"), 3),
    ).rejects.toBeInstanceOf(DeckRevisionConflictError);
    expect(context.state.decks).toHaveLength(1);
    expect(context.persisted).toEqual([]);
  });

  /* Same as the IndexedDB repository: a deck that is already gone is not a
     conflict, so a retried delete settles instead of blocking the editor. */
  it("delete of a missing deck settles without a conflict", async () => {
    const context = harness();
    await expect(
      context.repository.delete(deckId("ghost"), 1),
    ).resolves.toBeUndefined();
  });

  it("the default deck round-trips through the save", async () => {
    const context = harness({ decks: [storyDeck("alpha")] });
    await context.repository.setDefaultDeck(deckId("alpha"));
    expect(await context.repository.getDefaultDeck()).toBe("alpha");
    expect(context.state.defaultDeckId).toBe("alpha");
    expect(context.persisted).toHaveLength(1);

    await context.repository.setDefaultDeck(null);
    expect(await context.repository.getDefaultDeck()).toBeNull();
  });

  it("setDefaultDeck refuses a deck the save does not hold", async () => {
    const context = harness();
    await expect(
      context.repository.setDefaultDeck(deckId("ghost")),
    ).rejects.toBeInstanceOf(DeckStorageError);
    expect(context.persisted).toEqual([]);
  });

  /* A save can carry a default naming a deck it no longer has — the save layer
     checks it as an id rather than as a pointer. It reads as none set instead
     of as an id the caller then fails to load. */
  it("getDefaultDeck ignores a default whose deck is gone", async () => {
    const { repository } = harness({ decks: [], defaultDeckId: "ghost" });
    expect(await repository.getDefaultDeck()).toBeNull();
  });

  it("autosaves stay in memory, newest first, and never reach the save", async () => {
    const context = harness({ decks: [storyDeck("alpha")] });
    for (const index of [1, 2, 3])
      await context.repository.appendAutosave(autosave(`a${index}`, "alpha"));

    expect(
      (await context.repository.listAutosaves()).map(({ id }) => id),
    ).toEqual(["a3", "a2", "a1"]);
    expect(context.persisted).toEqual([]);
    expect(JSON.stringify(context.state)).not.toContain("a1");
  });

  it("the autosave log is capped like the free-play one", async () => {
    const context = harness({ decks: [storyDeck("alpha")] });
    for (let index = 0; index <= MAXIMUM_DECK_AUTOSAVES; index += 1)
      await context.repository.appendAutosave(autosave(`a${index}`, "alpha"));

    const log = await context.repository.listAutosaves();
    expect(log).toHaveLength(MAXIMUM_DECK_AUTOSAVES);
    expect(log.at(-1)?.id).toBe("a1");
  });

  it("last-opened round-trips within the session without reaching the save", async () => {
    const context = harness({ decks: [storyDeck("alpha")] });
    await context.repository.setLastOpened(deckId("alpha"));
    expect(await context.repository.getLastOpened()).toBe("alpha");
    expect(context.persisted).toEqual([]);
    expect(JSON.stringify(context.state)).not.toContain("lastOpened");

    await context.repository.clearLastOpened(deckId("beta"));
    expect(await context.repository.getLastOpened()).toBe("alpha");
    await context.repository.clearLastOpened();
    expect(await context.repository.getLastOpened()).toBeNull();
  });

  it("setLastOpened refuses a deck the save does not hold", async () => {
    const { repository } = harness();
    await expect(
      repository.setLastOpened(deckId("ghost")),
    ).rejects.toBeInstanceOf(DeckStorageError);
  });

  it("favourites stay in memory and prune against the save", async () => {
    const context = harness({
      decks: [storyDeck("alpha"), storyDeck("beta")],
    });
    await context.repository.setFavourite(deckId("alpha"), true);
    await context.repository.setFavourite(deckId("beta"), true);
    expect(await context.repository.listFavourites()).toEqual([
      "alpha",
      "beta",
    ]);
    expect(context.persisted).toEqual([]);

    await context.repository.delete(deckId("beta"), 1);
    expect(await context.repository.listFavourites()).toEqual(["alpha"]);

    await context.repository.setFavourite(deckId("alpha"), false);
    expect(await context.repository.listFavourites()).toEqual([]);
  });

  it("setFavourite refuses to favourite a deck the save does not hold", async () => {
    const { repository } = harness();
    await expect(
      repository.setFavourite(deckId("ghost"), true),
    ).rejects.toBeInstanceOf(DeckStorageError);
  });

  /* The defining invariant. A deck the save layer cannot read back makes the
     whole save unreadable — progress, wallet and collection with it — so the
     record is checked against that layer's own predicate before it is allowed
     into the state that gets written. */
  it("refuses a record the save layer could not read back", async () => {
    const context = harness();
    await expect(
      context.repository.create(storyDeck("alpha", { main: [-1] }), history),
    ).rejects.toBeInstanceOf(DeckStorageError);
    expect(context.state.decks).toEqual([]);
    expect(context.persisted).toEqual([]);
  });

  /* The second defining invariant: a command the story dropped must never be
     followed by a write, or the editor is told a deck was saved while the save
     that lands still holds the old one. */
  it("never persists when the story dropped the command", async () => {
    const state: StoryState = createInitialStoryState();
    const persisted: StoryState[] = [];
    const repository = createStoryDeckRepository({
      readState: () => state,
      dispatch: () => {
        /* A holder wired to a stale store: the command is accepted and lost. */
      },
      persist: async () => {
        persisted.push(state);
      },
    });

    await expect(
      repository.create(storyDeck("alpha"), history),
    ).rejects.toBeInstanceOf(DeckStorageError);
    expect(persisted).toEqual([]);
  });

  /* `validateDeckRecord` in the free-play repository refuses a record whose
     `createdAt` is after its `updatedAt`, so a deck stamped by a clock behind
     its own creation could not move between the two worlds. */
  it("stamps an updatedAt that never precedes createdAt", async () => {
    const context = harness();
    const stored = await context.repository.create(
      storyDeck("alpha", { createdAt: "2099-01-01T00:00:00.000Z" }),
      history,
    );
    expect(stored.deck.updatedAt).toBe("2099-01-01T00:00:00.000Z");
  });

  it("keeps each deck's history for the session", async () => {
    const context = harness();
    const edited: DeckHistory = { undo: [], redo: [], nextSequence: 7 };
    await context.repository.create(storyDeck("alpha"), history);
    await context.repository.save(
      1,
      storyDeck("alpha", { revision: 1 }),
      edited,
    );

    expect((await context.repository.load(deckId("alpha")))?.history).toEqual(
      edited,
    );
  });
});

/* Everything above stubs the write. This drives the same adapter through the
   real store, because the requirement is not that `persist` was called: it is
   that the record which lands is one this build can still read back. A deck the
   save layer rejects costs the player the whole save, progress and wallet
   included, and nothing validates on the way in. */

describe("a deck edit is part of the save", () => {
  afterEach(async () => {
    await deleteDB(STORY_SAVES_DATABASE_NAME);
  });

  it("round-trips deck edits through the real story save path", async () => {
    const saves = createStorySaveRepository(indexedDB, () => 1_700_000_000_000);
    let state: StoryState = {
      ...createInitialStoryState(),
      progressExists: true,
    };
    const repository = createStoryDeckRepository({
      readState: () => state,
      dispatch: (command) => {
        state = reduceStory(state, command);
      },
      persist: async () => {
        const result = await saves.write("manual:1", state, null);
        if (result.kind !== "written") throw new Error(result.kind);
      },
    });

    await repository.create(storyDeck("alpha"), history);
    await repository.create(storyDeck("beta"), history);
    await repository.setDefaultDeck(deckId("beta"));

    const saved = await saves.read("manual:1");
    if (saved.kind !== "ready")
      throw new Error(`save read back as ${saved.kind}`);
    expect(saved.envelope.state.decks.map(({ id }) => id)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(saved.envelope.state.defaultDeckId).toBe("beta");

    await repository.delete(deckId("beta"), 1);

    const afterDelete = await saves.read("manual:1");
    if (afterDelete.kind !== "ready")
      throw new Error(`save read back as ${afterDelete.kind}`);
    expect(afterDelete.envelope.state.decks.map(({ id }) => id)).toEqual([
      "alpha",
    ]);
    expect(afterDelete.envelope.state.defaultDeckId).toBeNull();
  });
});
