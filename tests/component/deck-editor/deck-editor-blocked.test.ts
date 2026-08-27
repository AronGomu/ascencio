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
import {
  DECK_DATABASE_VERSION_1,
  openDeckDatabase,
} from "../../fixtures/deck-database.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

/* This test file owns the single mount that must see a blocked open (not a
   migration error). The repository caches its migration, so each test file
   gets its own module registry. No legacy database is seeded, so the
   migration does nothing and the blocked open is hit directly. */

let openOld: IDBDatabase | null = null;

afterEach(async () => {
  cleanup();
  openOld?.close();
  openOld = null;
  await deleteDB(DECK_DATABASE_NAME);
  await deleteDB(LEGACY_DECK_DATABASE_NAME);
});

function query(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
}

describe("deck editor blocked open", () => {
  it("renders error screen when another tab holds an older database version", async () => {
    /* Hold the production database open at version 1. There is no legacy
       database, so migration does nothing. The repository then tries to open
       at version 2 and is blocked by this connection. */
    openOld = await openDeckDatabase(
      DECK_DATABASE_NAME,
      DECK_DATABASE_VERSION_1,
    );

    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });

    await waitFor(() => expect(query("deck-editor-error")).not.toBeNull());
    expect(query("deck-editor-error")?.getAttribute("role")).toBe("alert");
    expect(query("deck-editor-error-message")?.textContent).toContain(
      "deck library open at an older version",
    );
    /* The loading skeleton must not remain visible under the error. */
    expect(query("deck-editor-loading-skeleton")).toBeNull();
    /* This is NOT a migration error — that path has its own screen. */
    expect(query("deck-migration-error")).toBeNull();
  });
});
