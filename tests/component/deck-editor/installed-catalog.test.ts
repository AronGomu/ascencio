// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import { installedDeckCatalog } from "../../../src/decks/catalog/installed-gameplay-cards.ts";
import {
  PROTOTYPE_RULESET,
  catalogByCode,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { deckId, DECK_DATABASE_NAME } from "../../../src/decks/index.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";

const gameplay = installedDuelGameplayFixture();
const cards = installedDeckCatalog(gameplay).cards;

async function seedDeck(): Promise<void> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    await repository.create(
      createBlankDeck(
        "Installed Pool",
        catalogByCode(cards),
        PROTOTYPE_RULESET,
        {
          id: "installed-pool",
        },
      ),
      emptyDeckHistory(),
    );
  } finally {
    repository.close();
  }
}

afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

describe("installed deck editor catalog", () => {
  it("offers only installed non-token cards", async () => {
    await seedDeck();
    render(DeckEditorApp, {
      gameplay,
      deckId: deckId("installed-pool"),
      onnavigate: vi.fn(),
    });

    await waitFor(() =>
      expect(
        document.querySelector('[data-cy="deck-catalog-result-count"]')
          ?.textContent,
      ).toBe(`${cards.length - 1} results`),
    );
  });
});
