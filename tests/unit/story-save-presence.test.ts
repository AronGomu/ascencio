import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORY_SAVES_DATABASE_NAME,
  STORY_SAVES_STORE_NAME,
  storySaveExists,
} from "../../src/shell/screens/story-save-presence.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import * as storyContracts from "../../src/story/saves/story-save-contracts.ts";
import { createStorySaveRepository } from "../../src/story/saves/story-save-repository.ts";

function deleteStoryDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(STORY_SAVES_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function listDatabaseNames(): Promise<readonly string[]> {
  return (await indexedDB.databases()).map(({ name }) => name ?? "");
}

beforeEach(async () => {
  await deleteStoryDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* The shell declares these names rather than importing them: `src/story/index.ts`
   is the visual novel's lazy chunk entry, and the main menu is eager. This is
   the pin that keeps the two copies one fact. */
describe("the names the shell probes with", () => {
  it("are the ones the story actually writes under", () => {
    expect(STORY_SAVES_DATABASE_NAME).toBe(
      storyContracts.STORY_SAVES_DATABASE_NAME,
    );
    expect(STORY_SAVES_STORE_NAME).toBe(storyContracts.STORY_SAVES_STORE_NAME);
  });
});

describe("storySaveExists", () => {
  it("answers no when the story has never been played", async () => {
    expect(await storySaveExists(indexedDB)).toBe(false);
  });

  /* The repository creates the `saves` store only on `upgradeneeded`. A probe
     that created the database itself would leave a version-1 database with no
     object store, and `createStorySaveRepository` would then never be able to
     save at all — its `open(name, 1)` would find the version it wants and skip
     the upgrade that builds the store. */
  it("does not create the database it did not find", async () => {
    await storySaveExists(indexedDB);
    expect(await listDatabaseNames()).not.toContain(STORY_SAVES_DATABASE_NAME);

    const repository = createStorySaveRepository(indexedDB);
    const written = await repository.write(
      "autosave",
      createInitialStoryState(),
      null,
    );

    expect(written).toStrictEqual({ kind: "written", revision: 1 });
  });

  it("answers no while the store exists but holds nothing", async () => {
    const repository = createStorySaveRepository(indexedDB);
    await repository.write("autosave", createInitialStoryState(), null);
    await repository.clear("autosave");

    expect(await storySaveExists(indexedDB)).toBe(false);
  });

  it("answers yes once the story has written a save", async () => {
    const repository = createStorySaveRepository(indexedDB);
    await repository.write("autosave", createInitialStoryState(), null);

    expect(await storySaveExists(indexedDB)).toBe(true);
  });

  /* Storage being unreachable and storage holding nothing are the same answer
     to the menu: no Continue. The warning is what says which one it was. */
  it("answers no and warns when the database cannot be opened", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const factory = {
      open: () => {
        throw new DOMException("blocked by policy", "SecurityError");
      },
    } as unknown as IDBFactory;

    expect(await storySaveExists(factory)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
