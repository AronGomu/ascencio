import "fake-indexeddb/auto";

import { openDB } from "idb";
import { describe, expect, it, vi } from "vitest";
import { DECK_SOURCES } from "../../src/battle/duel/presets/deck-sources-browser.ts";
import { DECK_DATABASE_NAME } from "../../src/decks/index.ts";
import { reviewedCardPool } from "../../src/battle/duel/presets/reviewed-card-pool.ts";
import {
  ADMIN_ROUTES,
  ADMIN_STORAGE_TARGETS,
  ADMIN_TEST_DECK_ID,
  buildAdminTestDeck,
  resetStorageTarget,
  type AdminStorageTarget,
} from "../../src/shell/admin/admin-actions.ts";

function target(id: string): AdminStorageTarget {
  const found = ADMIN_STORAGE_TARGETS.find((entry) => entry.id === id);
  expect(found, `storage target ${id}`).toBeDefined();
  return found!;
}

describe("admin route index", () => {
  it("covers every route reachable without an id and excludes admin", () => {
    const kinds = ADMIN_ROUTES.map((route) => route.kind);
    expect(kinds).toContain("home");
    expect(kinds).toContain("free-play");
    expect(kinds).toContain("free-play-decks");
    expect(kinds).toContain("free-play-collection");
    expect(kinds).toContain("story");
    expect(kinds).toContain("story-decks");
    expect(kinds).toContain("story-collection");
    expect(kinds).not.toContain("admin");
  });
});

describe("admin storage targets", () => {
  it("are unique by id and by name", () => {
    const ids = ADMIN_STORAGE_TARGETS.map((entry) => entry.id);
    const names = ADMIN_STORAGE_TARGETS.map((entry) => entry.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names the decks and duel-snapshot databases", () => {
    expect(target("decks").kind).toBe("indexeddb");
    expect(target("duel-snapshots").name).toBe("ygo-story-duel");
  });

  /* The library the console clears is the free-play one, and saying so is the
     whole of the rename: the database underneath it is the one every deck ever
     built is already in, so the name may not follow the label (ADR-049). */
  it("admin still targets the deck database", () => {
    expect(target("decks").name).toBe(DECK_DATABASE_NAME);
    expect(target("decks").label).toBe("Free-play deck library");
  });

  it("resets story saves under the production database name", () => {
    expect(target("story-saves").kind).toBe("indexeddb");
    expect(target("story-saves").name).toBe("ygo-story-saves");
  });
});

describe("resetStorageTarget", () => {
  it("deletes an IndexedDB database", async () => {
    const name = `admin-reset-${crypto.randomUUID()}`;
    const database = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore("rows");
      },
    });
    await database.put("rows", { value: 1 }, "only");
    database.close();
    expect((await indexedDB.databases()).map((entry) => entry.name)).toContain(
      name,
    );

    await resetStorageTarget(
      { id: "probe", label: "Probe", kind: "indexeddb", name },
      indexedDB,
      { removeItem: () => {} },
    );

    expect(
      (await indexedDB.databases()).map((entry) => entry.name),
    ).not.toContain(name);
  });

  it("clears a localStorage key", async () => {
    const removeItem = vi.fn();
    await resetStorageTarget(target("shell-settings"), indexedDB, {
      removeItem,
    });
    expect(removeItem).toHaveBeenCalledExactlyOnceWith("ygo.ui.v3");
  });

  it("rejects a forged target kind", async () => {
    const forged = {
      id: "forged",
      label: "Forged",
      kind: "cookies",
      name: "nope",
    } as unknown as AdminStorageTarget;
    await expect(
      resetStorageTarget(forged, indexedDB, { removeItem: () => {} }),
    ).rejects.toThrow(Error);
  });
});

describe("buildAdminTestDeck", () => {
  it("returns 40 main cards drawn from the bundled preset pool", () => {
    const pool = reviewedCardPool(DECK_SOURCES);
    const deck = buildAdminTestDeck();
    expect(deck.main).toHaveLength(40);
    for (const code of [...deck.main, ...deck.extra, ...deck.side])
      expect(pool.has(code)).toBe(true);
  });

  it("is stable across calls", () => {
    expect(buildAdminTestDeck()).toEqual(buildAdminTestDeck());
  });

  it("uses a fixed deck id", () => {
    expect(ADMIN_TEST_DECK_ID).toBe("admin-test-deck");
  });
});
