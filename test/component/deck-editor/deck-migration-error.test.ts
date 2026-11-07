import {
  openTestDeckRepository,
  disposeTestDeckRepositories,
  type TestDeckRepository,
} from "../../fixtures/sqlite-deck-repository.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import * as legacyDatabase from "../../fixtures/deck-database.ts";
import { DeckStorageError } from "../../../src/decks/repository/index.ts";
import {
  createBlankDeck,
  emptyDeckHistory,
} from "../../../src/decks/editing/index.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";
import {
  openDeckDatabase,
  seedDeckDatabase,
  transactionSettled,
} from "../../fixtures/deck-database.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installedEditorCatalog } from "../../fixtures/installed-gameplay.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";

const TEST_DATABASE_NAME = "editor-injected-read-failure";
let repository: TestDeckRepository | null = null;
let openLegacy: IDBDatabase | null = null;

afterEach(async () => {
  cleanup();
  await repository?.close();
  repository = null;
  openLegacy?.close();
  openLegacy = null;
  vi.restoreAllMocks();
  await disposeTestDeckRepositories();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(
      legacyDatabase.LEGACY_DECK_DATABASE_NAME,
    );
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

function query(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
}

/* Replaces automatic prototype copy/delete failure: injected persistence may
   fail, but even a surviving prototype database is never opened or migrated
   by the editor. The injected deck backend uses real Node SQLite. */
describe("deck editor injected persistence failure", () => {
  it("blocks editing with a retry while leaving the prototype database untouched", async () => {
    const draft = createBlankDeck(
      "Prototype Deck",
      prototypeCatalogMap,
      PROTOTYPE_RULESET,
      { id: "prototype-deck", now: new Date("2026-01-01T00:00:00.000Z") },
    );
    const legacyDeck = { ...draft, revision: 1 };
    await seedDeckDatabase(legacyDatabase.LEGACY_DECK_DATABASE_NAME, {
      decks: [legacyDeck],
    });
    openLegacy = await openDeckDatabase(
      legacyDatabase.LEGACY_DECK_DATABASE_NAME,
    );
    // SQLite is independent of the surviving historical sentinel database.
    repository = await openTestDeckRepository(TEST_DATABASE_NAME);
    const current = await repository.create(
      { ...draft, name: "Injected Deck" },
      emptyDeckHistory(),
    );
    await repository.setDefaultDeck(current.deck.id);
    const injected = repository;
    const failure = new DeckStorageError("Injected deck read failed");
    const list = vi.spyOn(injected, "list").mockRejectedValue(failure);
    const createRepository = vi.fn(() => injected);
    const open = vi.spyOn(indexedDB, "open");
    const remove = vi.spyOn(indexedDB, "deleteDatabase");
    const put = vi.spyOn(IDBObjectStore.prototype, "put");
    const add = vi.spyOn(IDBObjectStore.prototype, "add");

    render(DeckEditorApp, {
      props: {
        context: { kind: "free-play", createRepository },
        catalogInput: installedEditorCatalog(installedDuelGameplayFixture()),
        deckId: null,
        onnavigate: vi.fn(),
      },
    });

    await waitFor(() => expect(query("deck-editor-error")).not.toBeNull());
    expect(query("deck-editor-error")?.getAttribute("role")).toBe("alert");
    expect(query("deck-editor-error-message")?.textContent).toContain(
      "Injected deck read failed",
    );
    expect(createRepository).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalled();
    await expect(list.mock.results[0]!.value).rejects.toBe(failure);
    expect(
      (screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(query("deck-editor-loading-skeleton")).toBeNull();
    expect(query("deck-library")).toBeNull();
    expect(query("deck-migration-error")).toBeNull();
    expect(open).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();

    // Read through the already-owned handle: no reopen can hide an attempt.
    const transaction = openLegacy.transaction("decks", "readonly");
    const request = transaction.objectStore("decks").getAll();
    await transactionSettled(transaction);
    expect(request.result).toEqual([legacyDeck]);
    cleanup();
    // Context release is a no-op: the fixture still owns the usable repository.
    expect((await injected.load(current.deck.id))?.deck.name).toBe(
      "Injected Deck",
    );
  });
});
