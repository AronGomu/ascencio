// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import { STARTER_DECK_NAME } from "../../../src/decks/starter-deck.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

async function libraryRowNames(): Promise<readonly string[]> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    return (await repository.list()).map(({ name }) => name);
  } finally {
    repository.close();
  }
}

/* The seeding call sits on the editor's mount path, between opening storage
   and the controller's first read, so these cases drive it the way the shell
   does rather than calling `ensureStarterDeck` directly. */
describe("starter deck seeding on mount", () => {
  it("a first visit lands on a library holding the default starter deck", async () => {
    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    await waitFor(() =>
      expect(document.querySelector('[data-cy="deck-library"]')).not.toBeNull(),
    );
    const badge = document.querySelector(
      '[data-cy^="deck-library-default-badge-"]',
    );
    expect(badge?.textContent).toContain("Default");
    expect(
      badge?.closest("li")?.querySelector('[data-cy^="deck-library-name-"]')
        ?.textContent,
    ).toBe(STARTER_DECK_NAME);
    expect(await libraryRowNames()).toEqual([STARTER_DECK_NAME]);
  });

  it("a second visit does not add a second starter deck", async () => {
    const first = render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    await waitFor(() =>
      expect(
        document.querySelector('[data-cy^="deck-library-default-badge-"]'),
      ).not.toBeNull(),
    );
    first.unmount();

    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    await waitFor(() =>
      expect(
        document.querySelector('[data-cy^="deck-library-default-badge-"]'),
      ).not.toBeNull(),
    );
    expect(await libraryRowNames()).toEqual([STARTER_DECK_NAME]);
  });
});

describe("the default deck through the controller", () => {
  it("set default marks a deck and deleting that deck clears the mark", async () => {
    const repository = await IndexedDbDeckRepository.open();
    const controller = new DeckBuilderController(
      repository,
      prototypeCatalogMap,
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Chosen");
    const { id, revision } = get(controller).current!.deck;
    expect(get(controller).defaultDeckId).toBeNull();

    await controller.setDefaultDeck(id);
    expect(get(controller).defaultDeckId).toBe(id);

    await controller.deleteDeck(id, revision);
    expect(get(controller).defaultDeckId).toBeNull();
    expect(await repository.getDefaultDeck()).toBeNull();
    repository.close();
  });
});
