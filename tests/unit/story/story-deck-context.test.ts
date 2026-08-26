// @vitest-environment node

import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { DeckStorageError } from "../../../src/decks/deck-storage-errors.ts";
import { openStoryDeckContext } from "../../../src/story/decks/story-deck-context.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import {
  STORY_SAVES_DATABASE_NAME,
  type StorySlotKey,
} from "../../../src/story/saves/story-save-contracts.ts";
import {
  createStorySaveRepository,
  type StorySaveRepository,
} from "../../../src/story/saves/story-save-repository.ts";

/* The one place a story deck context is built, so this is where "which save is
   the editor about to write into" is decided. Driven against the real save
   repository over `fake-indexeddb`: the mistake worth catching is a context
   that edits a slot the player is not resuming, or one that reports a refused
   write as a successful save. */

afterEach(async () => {
  await deleteDB(STORY_SAVES_DATABASE_NAME);
});

function saveState(overrides: Partial<StoryState> = {}): StoryState {
  return {
    ...createInitialStoryState(),
    screen: "map",
    savedScreen: "map",
    progressExists: true,
    ...overrides,
  };
}

/** Writes `state` into `slot` as a player's own save, stamped at `savedAt` so
    the newest-slot rule below is decided by this test rather than by the
    clock. */
async function seed(
  slot: StorySlotKey,
  state: StoryState,
  savedAt: number,
): Promise<void> {
  const result = await createStorySaveRepository(
    indexedDB,
    () => savedAt,
  ).write(slot, state, null);
  expect(result.kind).toBe("written");
}

function saves(): StorySaveRepository {
  return createStorySaveRepository(indexedDB, () => 1_700_000_000_000);
}

async function storedDeckIds(slot: StorySlotKey): Promise<readonly string[]> {
  const read = await saves().read(slot);
  if (read.kind !== "ready") throw new Error(`${slot} holds no save`);
  return read.envelope.state.decks.map(({ id }) => id);
}

describe("openStoryDeckContext", () => {
  it("answers no context when the player has no save", async () => {
    expect(await openStoryDeckContext(saves())).toBeNull();
  });

  /* The duel checkpoint is the shell's own scratch slot, not progress the
     player chose to keep: editing it would put deck edits into a record the
     next duel hand-back overwrites. */
  it("answers no context when only the duel checkpoint exists", async () => {
    await seed("checkpoint:pre-duel", saveState(), 10);

    expect(await openStoryDeckContext(saves())).toBeNull();
  });

  it.each([
    ["the autosave is newer", 10, 20, ["from-autosave"]],
    ["the manual save is newer", 20, 10, ["from-manual"]],
  ])(
    "edits the save Continue resumes when %s",
    async (_name, manualAt, autosaveAt, expected) => {
      await seed(
        "manual:1",
        saveState({ decks: [storyDeckFixture("from-manual")] }),
        manualAt,
      );
      await seed(
        "autosave",
        saveState({ decks: [storyDeckFixture("from-autosave")] }),
        autosaveAt,
      );

      const context = await openStoryDeckContext(saves());
      if (context?.kind !== "story") throw new Error("no story context");

      expect(
        (await context.createRepository().list()).map(({ id }) => id),
      ).toStrictEqual(expected);
    },
  );

  it("writes an edit back into the slot it was read from", async () => {
    await seed("manual:1", saveState({ decks: [] }), 20);
    await seed("autosave", saveState({ decks: [] }), 10);
    const context = await openStoryDeckContext(saves());
    if (context?.kind !== "story") throw new Error("no story context");

    await context
      .createRepository()
      .create(storyDeckFixture("built-here"), emptyDeckHistory());

    expect(await storedDeckIds("manual:1")).toStrictEqual(["built-here"]);
    expect(await storedDeckIds("autosave")).toStrictEqual([]);
  });

  /* Two writes in a row: the second has to carry the revision the first landed
     on, or the store refuses it as stale and the player loses the edit. */
  it("keeps writing after the first save", async () => {
    await seed("manual:1", saveState({ decks: [] }), 20);
    const context = await openStoryDeckContext(saves());
    if (context?.kind !== "story") throw new Error("no story context");
    const repository = context.createRepository();

    await repository.create(storyDeckFixture("first"), emptyDeckHistory());
    await repository.create(storyDeckFixture("second"), emptyDeckHistory());

    expect(await storedDeckIds("manual:1")).toStrictEqual(["first", "second"]);
  });

  it("reads ownership from the save's own collection", async () => {
    await seed("manual:1", saveState({ collection: { 89631139: 2 } }), 20);

    const context = await openStoryDeckContext(saves());
    if (context?.kind !== "story") throw new Error("no story context");

    expect(context.ownership.isUnlimited).toBe(false);
    expect(context.ownership.ownedCount(89631139)).toBe(2);
    expect(context.ownership.ownedCount(46986414)).toBe(0);
  });

  it("names the save the editor is about to write into", async () => {
    await seed("manual:1", saveState({ savedScreen: "map" }), 20);

    const context = await openStoryDeckContext(saves());

    expect(context?.kind === "story" ? context.label : null).toBe(
      "The Signal Beneath the City · City map",
    );
  });

  /* A refused write must reach the editor as a failure. Reported as success it
     would leave the player looking at a saved deck that is not in their save. */
  it("reports a refused write to the editor", async () => {
    const refusing: StorySaveRepository = {
      ...saves(),
      write: () => Promise.resolve({ kind: "failed", reason: "quota" }),
    };
    await seed("manual:1", saveState({ decks: [] }), 20);
    const context = await openStoryDeckContext(refusing);
    if (context?.kind !== "story") throw new Error("no story context");

    await expect(
      context
        .createRepository()
        .create(storyDeckFixture("unwritable"), emptyDeckHistory()),
    ).rejects.toThrow(DeckStorageError);
  });

  /* The write refused once, then allowed: the editor's retry path. The context
     must roll its state back on the refusal, or the retry writes a save whose
     revision the store no longer holds. */
  it("rolls the save back so a refused write can be retried", async () => {
    const real = saves();
    let refuse = true;
    const flaky: StorySaveRepository = {
      ...real,
      write: (slot, state, revision) =>
        refuse
          ? Promise.resolve({ kind: "failed", reason: "quota" })
          : real.write(slot, state, revision),
    };
    await seed("manual:1", saveState({ decks: [] }), 20);
    const context = await openStoryDeckContext(flaky);
    if (context?.kind !== "story") throw new Error("no story context");
    const repository = context.createRepository();

    await expect(
      repository.create(storyDeckFixture("retried"), emptyDeckHistory()),
    ).rejects.toThrow(DeckStorageError);
    expect(await repository.list()).toStrictEqual([]);

    refuse = false;
    await repository.create(storyDeckFixture("retried"), emptyDeckHistory());
    expect(await storedDeckIds("manual:1")).toStrictEqual(["retried"]);
  });
});
