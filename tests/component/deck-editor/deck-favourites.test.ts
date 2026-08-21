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
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

describe("starring a deck", () => {
  it("calls onfavourite with the new state when the star button is clicked", async () => {
    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    await waitFor(() =>
      expect(document.querySelector('[data-cy="deck-library"]')).not.toBeNull(),
    );

    const star = document.querySelector(
      '[data-cy^="deck-library-favourite-"]',
    ) as HTMLButtonElement | null;
    expect(star).not.toBeNull();
    expect(star!.getAttribute("aria-pressed")).toBe("false");

    star!.click();
    await waitFor(() =>
      expect(
        document
          .querySelector('[data-cy^="deck-library-favourite-"]')
          ?.getAttribute("aria-pressed"),
      ).toBe("true"),
    );
  });

  it("toggling favourite persists and toggleFavourite reflects in controller state", async () => {
    const repository = await IndexedDbDeckRepository.open();
    const controller = new DeckBuilderController(
      repository,
      prototypeCatalogMap,
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Star Test");
    const { id } = get(controller).current!.deck;
    expect(get(controller).favouriteDeckIds).toEqual([]);

    await controller.toggleFavourite(id);
    expect(get(controller).favouriteDeckIds).toContain(id);

    await controller.toggleFavourite(id);
    expect(get(controller).favouriteDeckIds).not.toContain(id);
    repository.close();
  });
});
