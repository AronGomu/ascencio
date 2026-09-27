import {
  openTestDeckRepository,
  disposeTestDeckRepositories,
  type TestDeckRepository,
} from "../../fixtures/sqlite-deck-repository.ts";
import { installedEditorCatalog } from "../../fixtures/installed-gameplay.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import { installedDeckCatalog } from "../../../src/decks/catalog/installed-gameplay-cards.ts";
import {
  PROTOTYPE_RULESET,
  catalogByCode,
} from "../../../src/decks/validation/index.ts";
import { deckId } from "../../../src/decks/index.ts";
import {
  emptyDeckHistory,
  createBlankDeck,
} from "../../../src/decks/editing/index.ts";

import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";

const gameplay = installedDuelGameplayFixture();
const cards = installedDeckCatalog(gameplay).cards;

async function seedDeck(): Promise<void> {
  await repository.create(
    createBlankDeck("Installed Pool", catalogByCode(cards), PROTOTYPE_RULESET, {
      id: "installed-pool",
    }),
    emptyDeckHistory(),
  );
}

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

describe("installed deck editor catalog", () => {
  it("offers only installed non-token cards", async () => {
    await seedDeck();
    render(DeckEditorApp, {
      props: {
        context: { kind: "free-play", createRepository: () => repository },
        catalogInput: installedEditorCatalog(gameplay),
        deckId: deckId("installed-pool"),
        onnavigate: vi.fn(),
      },
    });

    await waitFor(() =>
      expect(
        document.querySelector('[data-cy="deck-catalog-result-count"]')
          ?.textContent,
      ).toBe(`${cards.length - 1} results`),
    );
  });
});
