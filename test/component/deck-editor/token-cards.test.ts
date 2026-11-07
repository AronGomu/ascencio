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
import DeckEditorApp from "../../../src/deck-editor/index.ts";

import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";
import { deckId } from "../../../src/decks/contracts/index.ts";
import {
  emptyDeckHistory,
  createBlankDeck,
} from "../../../src/decks/editing/index.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";
import { SHEEP_TOKEN_CODE } from "../../fixtures/token-card.ts";

installPrototypeActiveCatalog();
/* The production catalog is the whole card database, Tokens included, because
   the duel names a token it summons from the same read. */

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

async function seedDeck(id: string): Promise<void> {
  const deck = createBlankDeck(
    "Token Test",
    prototypeCatalogMap,
    PROTOTYPE_RULESET,
    { id, now: new Date("2026-01-01T00:00:00.000Z") },
  );
  await repository.create(deck, emptyDeckHistory());
}

describe("Tokens in the shared runtime catalog", () => {
  it("are never offered by the editor's catalog", async () => {
    await seedDeck("d-token");
    render(DeckEditorApp, {
      props: {
        context: { kind: "free-play", createRepository: () => repository },
        catalogInput: installedEditorCatalog(installedDuelGameplayFixture()),
        deckId: deckId("d-token"),
        onnavigate: vi.fn(),
      },
    });
    await waitFor(() =>
      expect(document.querySelector('[data-cy="deck-catalog"]')).not.toBeNull(),
    );

    expect(
      document.querySelector(
        `[data-cy="deck-catalog-results"] [data-cy="catalog-tile-${SHEEP_TOKEN_CODE}"]`,
      ),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="deck-catalog-result-count"]')
        ?.textContent,
    ).toBe(`${PROTOTYPE_CATALOG.length - 1} results`);
  });
});
