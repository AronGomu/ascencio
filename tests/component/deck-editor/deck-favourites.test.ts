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

describe("deck library marks", () => {
  it("exposes no favourite repository or controller API", async () => {
    const repository = await IndexedDbDeckRepository.open();
    const controller = new DeckBuilderController(
      repository,
      prototypeCatalogMap,
      PROTOTYPE_RULESET,
    );
    await controller.initialize();

    expect("listFavourites" in repository).toBe(false);
    expect("setFavourite" in repository).toBe(false);
    expect("toggleFavourite" in controller).toBe(false);
    expect("favouriteDeckIds" in get(controller)).toBe(false);
    repository.close();
  });

  it("renders no favourite controls", async () => {
    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    await waitFor(() =>
      expect(document.querySelector('[data-cy="deck-library"]')).not.toBeNull(),
    );

    expect(document.querySelector('[data-cy^="deck-tile-fav-"]')).toBeNull();
    expect(document.querySelector('[aria-label^="Favourite "]')).toBeNull();
  });
});
