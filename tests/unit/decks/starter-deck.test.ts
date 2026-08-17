// @vitest-environment node

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import {
  DECK_DATABASE_NAME,
  LEGACY_DECK_DATABASE_NAME,
} from "../../../src/decks/deck-database.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import {
  ensureStarterDeck,
  STARTER_DECK_NAME,
} from "../../../src/decks/starter-deck.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";

const names: string[] = [];
const catalog = catalogByCode(PROTOTYPE_CATALOG);

/* The bundled starter list names cards the prototype fixture catalog does not
   carry, so every case injects a fixture-code list through the source
   parameter. What is under test is the seeding decision, not the payload. */
const FIXTURE_YDK = [
  "#created by a fixture",
  "#main",
  "89631139",
  "46986414",
  "#extra",
  "8505920",
  "!side",
  "74677422",
  "",
].join("\n");

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

describe("ensureStarterDeck", () => {
  it("a fresh repository is seeded with the starter deck marked default", async () => {
    const repo = await repository("starter-fresh");
    await ensureStarterDeck(repo, catalog, PROTOTYPE_RULESET, FIXTURE_YDK);
    const decks = await repo.list();
    expect(decks.map(({ name }) => name)).toEqual([STARTER_DECK_NAME]);
    expect(decks[0]?.main).toEqual([89631139, 46986414]);
    expect(decks[0]?.extra).toEqual([8505920]);
    expect(decks[0]?.side).toEqual([74677422]);
    expect(decks[0]?.importedNeedsReview).toBe(false);
    expect(await repo.getDefaultDeck()).toBe(decks[0]?.id);
    repo.close();
  });

  /* Seeding runs on every mount, so running it twice is the ordinary case
     rather than an edge one: a second run must find its own work already
     done and leave the library at one deck. */
  it("running seeding twice leaves one starter deck and the same default", async () => {
    const repo = await repository("starter-idempotent");
    await ensureStarterDeck(repo, catalog, PROTOTYPE_RULESET, FIXTURE_YDK);
    const first = await repo.getDefaultDeck();
    await ensureStarterDeck(repo, catalog, PROTOTYPE_RULESET, FIXTURE_YDK);
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.getDefaultDeck()).toBe(first);
    repo.close();
  });

  it("an existing default short-circuits seeding", async () => {
    const repo = await repository("starter-existing-default");
    const chosen = createBlankDeck("Player's own", catalog, PROTOTYPE_RULESET, {
      id: "chosen",
    });
    await repo.create(chosen, emptyDeckHistory());
    await repo.setDefaultDeck(chosen.id);
    await ensureStarterDeck(repo, catalog, PROTOTYPE_RULESET, FIXTURE_YDK);
    expect((await repo.list()).map(({ name }) => name)).toEqual([
      "Player's own",
    ]);
    expect(await repo.getDefaultDeck()).toBe(chosen.id);
    repo.close();
  });

  it("an existing Starter Deck is adopted instead of duplicated", async () => {
    const repo = await repository("starter-adopted");
    const existing = createBlankDeck(
      STARTER_DECK_NAME,
      catalog,
      PROTOTYPE_RULESET,
      { id: "already-here" },
    );
    await repo.create(existing, emptyDeckHistory());
    await ensureStarterDeck(repo, catalog, PROTOTYPE_RULESET, FIXTURE_YDK);
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.getDefaultDeck()).toBe(existing.id);
    repo.close();
  });

  /* The editor opens whether or not it was seeded, so a broken storage layer
     is reported and swallowed rather than thrown at the mount that called. */
  it("swallows a storage failure and warns instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const repo = await repository("starter-failure");
    vi.spyOn(repo, "list").mockRejectedValue(new Error("storage unavailable"));
    await expect(
      ensureStarterDeck(repo, catalog, PROTOTYPE_RULESET, FIXTURE_YDK),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    repo.close();
  });
});
