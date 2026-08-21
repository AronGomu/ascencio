// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { deckId, type DeckId } from "../../../src/decks/deck-contracts.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

async function seedDeck(id: string, name: string): Promise<DeckId> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    const deck = createBlankDeck(name, prototypeCatalogMap, PROTOTYPE_RULESET, {
      id,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repository.create(deck, emptyDeckHistory());
    return deck.id;
  } finally {
    repository.close();
  }
}

/* Another tab saved the deck since this page opened it, so the revision the
   delete carries is stale and storage refuses it. */
async function bumpRevisionElsewhere(id: DeckId): Promise<void> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    const stored = await repository.load(id);
    await repository.save(
      stored!.deck.revision,
      { ...stored!.deck, name: "Renamed Elsewhere" },
      stored!.history,
    );
  } finally {
    repository.close();
  }
}

describe("a delete that storage refused", () => {
  it("reports failure rather than resolving like a success", async () => {
    const id = await seedDeck("d-fail", "Doomed");
    const repository = await IndexedDbDeckRepository.open();
    try {
      const controller = new DeckBuilderController(
        repository,
        prototypeCatalogMap,
        PROTOTYPE_RULESET,
      );
      await controller.initialize();
      const stale = (await repository.load(id))!.deck.revision;
      await bumpRevisionElsewhere(id);

      expect(await controller.deleteDeck(id, stale)).toBe(false);
      expect(get(controller).mode).toBe("error");
      expect(await repository.load(id)).not.toBeNull();
    } finally {
      repository.close();
    }
  });

  it("reports success when storage really dropped the deck", async () => {
    const id = await seedDeck("d-ok", "Doomed");
    const repository = await IndexedDbDeckRepository.open();
    try {
      const controller = new DeckBuilderController(
        repository,
        prototypeCatalogMap,
        PROTOTYPE_RULESET,
      );
      await controller.initialize();
      const revision = (await repository.load(id))!.deck.revision;

      expect(await controller.deleteDeck(id, revision)).toBe(true);
      expect(await repository.load(id)).toBeNull();
    } finally {
      repository.close();
    }
  });

  it("leaves the route on the deck page, because the deck still exists", async () => {
    const id = await seedDeck("d-route", "Doomed");
    const onnavigate = vi.fn();
    render(DeckEditorApp, { deckId: deckId("d-route"), onnavigate });
    await waitFor(() =>
      expect(
        document.querySelector('[data-cy="deck-name-input"]'),
      ).not.toBeNull(),
    );
    await bumpRevisionElsewhere(id);

    const user = userEvent.setup();
    await user.click(document.querySelector('[data-cy="deck-editor-delete"]')!);
    await user.click(
      document.querySelector('[data-cy="deck-editor-delete-confirm"]')!,
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-cy="deck-editor-error"]'),
      ).not.toBeNull(),
    );
    expect(onnavigate).not.toHaveBeenCalled();
  });
});
