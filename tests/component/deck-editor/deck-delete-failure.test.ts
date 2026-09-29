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
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";

import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";
import { deckId, type DeckId } from "../../../src/decks/contracts/index.ts";
import {
  emptyDeckHistory,
  createBlankDeck,
} from "../../../src/decks/editing/index.ts";
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

async function seedDeck(id: string, name: string): Promise<DeckId> {
  const deck = createBlankDeck(name, prototypeCatalogMap, PROTOTYPE_RULESET, {
    id,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
  await repository.create(deck, emptyDeckHistory());
  return deck.id;
}

/* Another tab saved the deck since this page opened it, so the revision the
   delete carries is stale and storage refuses it. */
async function bumpRevisionElsewhere(id: DeckId): Promise<void> {
  const repository = await openTestDeckRepository();
  try {
    const stored = await repository.load(id);
    await repository.save(
      stored!.deck.revision,
      { ...stored!.deck, name: "Renamed Elsewhere" },
      stored!.history,
    );
  } finally {
    await repository.close();
  }
}

describe("a delete that storage refused", () => {
  it("reports failure rather than resolving like a success", async () => {
    const id = await seedDeck("d-fail", "Doomed");
    const repository = await openTestDeckRepository();
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
      await repository.close();
    }
  });

  it("reports success when storage really dropped the deck", async () => {
    const id = await seedDeck("d-ok", "Doomed");
    const repository = await openTestDeckRepository();
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
      await repository.close();
    }
  });

  it("leaves the route on the deck page, because the deck still exists", async () => {
    const id = await seedDeck("d-route", "Doomed");
    const onnavigate = vi.fn();
    render(DeckEditorApp, {
      props: {
        context: { kind: "free-play", createRepository: () => repository },
        catalogInput: installedEditorCatalog(installedDuelGameplayFixture()),
        deckId: deckId("d-route"),
        onnavigate,
      },
    });
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
