import {
  openTestDeckRepository,
  disposeTestDeckRepositories,
  type TestDeckRepository,
} from "../../fixtures/sqlite-deck-repository.ts";
import { installedEditorCatalog } from "../../fixtures/installed-gameplay.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";

import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

// Real SQLite test backend; the fixture owns this injected connection.
let repository: TestDeckRepository;
beforeEach(async () => {
  repository = await openTestDeckRepository();
});

afterEach(async () => {
  cleanup();
  await repository.close();
  await disposeTestDeckRepositories();
});

describe("deck library marks", () => {
  it("exposes no favourite repository or controller API", async () => {
    const repository = await openTestDeckRepository();
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
    await repository.close();
  });

  it("renders no favourite controls", async () => {
    render(DeckEditorApp, {
      props: {
        context: { kind: "free-play", createRepository: () => repository },
        catalogInput: installedEditorCatalog(installedDuelGameplayFixture()),
        deckId: null,
        onnavigate: vi.fn(),
      },
    });
    await waitFor(() =>
      expect(document.querySelector('[data-cy="deck-library"]')).not.toBeNull(),
    );

    expect(document.querySelector('[data-cy^="deck-tile-fav-"]')).toBeNull();
    expect(document.querySelector('[aria-label^="Favourite "]')).toBeNull();
  });
});
