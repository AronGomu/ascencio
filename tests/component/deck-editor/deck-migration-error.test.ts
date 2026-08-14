// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import {
  DECK_DATABASE_NAME,
  LEGACY_DECK_DATABASE_NAME,
} from "../../../src/decks/deck-database.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import {
  openDeckDatabase,
  seedDeckDatabase,
} from "../../fixtures/deck-database.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";

/* The repository caches its migration for the lifetime of the module, and
   vitest gives each test file its own module registry. So this file owns the
   single mount that must see a failing migration: putting it beside the other
   deck-editor mounts would let their cached success answer for it. */

let openLegacy: IDBDatabase | null = null;

afterEach(async () => {
  cleanup();
  openLegacy?.close();
  openLegacy = null;
  await deleteDB(LEGACY_DECK_DATABASE_NAME);
  await deleteDB(DECK_DATABASE_NAME);
});

function query(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
}

describe("deck editor migration failure", () => {
  it("blocks the editor and offers a retry when the prototype database survives", async () => {
    const draft = createBlankDeck(
      "Prototype Deck",
      prototypeCatalogMap,
      PROTOTYPE_RULESET,
      { id: "prototype-deck", now: new Date("2026-01-01T00:00:00.000Z") },
    );
    await seedDeckDatabase(LEGACY_DECK_DATABASE_NAME, {
      decks: [{ ...draft, revision: 1 }],
    });

    /* A second tab still holding the prototype database open is what blocks the
       delete in a browser; the copy has already succeeded by then. */
    openLegacy = await openDeckDatabase(LEGACY_DECK_DATABASE_NAME);

    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });

    await waitFor(() => expect(query("deck-migration-error")).not.toBeNull());
    expect(query("deck-migration-error")?.getAttribute("role")).toBe("alert");
    expect(query("deck-migration-error-message")?.textContent).toContain(
      "could not be deleted",
    );
    expect(query("deck-migration-retry")).not.toBeNull();
    /* The library must not render underneath the blocking state. */
    expect(query("deck-library")).toBeNull();
    expect(query("deck-editor-error")).toBeNull();
  });
});
