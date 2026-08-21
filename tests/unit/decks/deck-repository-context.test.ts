// @vitest-environment node

import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import { deckId, type DeckRecord } from "../../../src/decks/deck-contracts.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { resolveDeckRepository } from "../../../src/decks/deck-repository-context.ts";
import {
  DeckStorageError,
  IndexedDbDeckRepository,
} from "../../../src/decks/indexeddb-deck-repository.ts";
import { createStoryDeckRepository } from "../../../src/story/decks/story-deck-repository.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import {
  deckDatabaseNames,
  deckDatabaseRows,
} from "../../fixtures/deck-database.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";

/* The split between the two deck worlds is a choice of repository and nothing
   else: no row moves, and the free-play database keeps the name and the schema
   it already has on every player's disk. So these tests assert against the real
   `ygo-story-decks` database rather than a repository opened under a test name
   — the mistake worth catching here is a resolver that quietly reads somewhere
   the player's decks are not. */

afterEach(async () => {
  await deleteDB(DECK_DATABASE_NAME);
});

function deckRecord(id: string): DeckRecord {
  return {
    schemaVersion: 1,
    id: deckId(id),
    revision: 1,
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

/** A story save the adapter can edit, driven by the real reducer so a context
    that resolves to it is exercised the way the editor will use it. */
function storySave(decks: readonly string[]) {
  let state: StoryState = {
    ...createInitialStoryState(),
    decks: decks.map((id) => storyDeckFixture(id)),
  };
  return {
    createRepository: () =>
      createStoryDeckRepository({
        readState: () => state,
        dispatch: (command) => {
          state = reduceStory(state, command);
        },
        persist: () => Promise.resolve(),
      }),
  };
}

describe("resolveDeckRepository", () => {
  it("free play resolves to the IndexedDB library", async () => {
    const handle = await resolveDeckRepository({ kind: "free-play" });
    await handle.repository.create(deckRecord("written"), emptyDeckHistory());
    handle.close();

    const rows = (await deckDatabaseRows(
      DECK_DATABASE_NAME,
      "decks",
    )) as readonly DeckRecord[];
    expect(rows.map(({ id }) => id)).toStrictEqual(["written"]);
  });

  it("the free-play database name is unchanged", () => {
    expect(DECK_DATABASE_NAME).toBe("ygo-story-decks");
  });

  it("existing decks remain listed in free play", async () => {
    /* Seeded through the repository the shipped build writes with, so this is
       a database as a real player already has it rather than a fixture shaped
       to match the reader. */
    const previousBuild = await IndexedDbDeckRepository.open();
    await previousBuild.create(deckRecord("alpha"), emptyDeckHistory());
    await previousBuild.create(deckRecord("beta"), emptyDeckHistory());
    previousBuild.close();

    const handle = await resolveDeckRepository({ kind: "free-play" });
    const listed = await handle.repository.list();
    handle.close();

    expect(listed.map(({ id }) => id).sort()).toStrictEqual(["alpha", "beta"]);
  });

  it("a story context resolves to the save adapter", async () => {
    const handle = await resolveDeckRepository({
      kind: "story",
      ...storySave(["saved-one", "saved-two"]),
    });

    expect((await handle.repository.list()).map(({ id }) => id)).toStrictEqual([
      "saved-one",
      "saved-two",
    ]);
    /* The save adapter holds no connection, and a story context must not so
       much as create the free-play library. */
    handle.close();
    expect(await deckDatabaseNames()).not.toContain(DECK_DATABASE_NAME);
  });

  it("closing a free-play handle releases the database connection", async () => {
    const handle = await resolveDeckRepository({ kind: "free-play" });
    /* Detached from the handle, because that is how the editor holds it: it
       keeps one `close` variable for a teardown that may run before the
       repository ever arrives. */
    const { close } = handle;
    close();

    await expect(handle.repository.list()).rejects.toThrow(DeckStorageError);
  });
});
