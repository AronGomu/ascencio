// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import { deckId, type DeckId } from "../../../src/decks/deck-contracts.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

/* Renaming from the library is not the deck page's rename: the deck being
   renamed is not the deck that is open, and on the library screen no deck is
   open at all. `rename` only ever touches `current`, so a library-context
   rename needs its own by-id path. */

installPrototypeActiveCatalog();

afterEach(async () => {
  await deleteDB(DECK_DATABASE_NAME);
});

async function libraryWithTwoDecks(): Promise<{
  readonly repository: IndexedDbDeckRepository;
  readonly controller: DeckBuilderController;
  readonly first: DeckId;
  readonly second: DeckId;
}> {
  const repository = await IndexedDbDeckRepository.open();
  const controller = new DeckBuilderController(
    repository,
    prototypeCatalogMap,
    PROTOTYPE_RULESET,
  );
  await controller.initialize();
  await controller.createDeck("Alpha");
  const first = get(controller).current!.deck.id;
  await controller.createDeck("Bravo");
  const second = get(controller).current!.deck.id;
  return { repository, controller, first, second };
}

function names(controller: DeckBuilderController): readonly string[] {
  return get(controller)
    .decks.map(({ name }) => name)
    .sort();
}

describe("renaming a deck from the library", () => {
  it("renames without opening the deck", async () => {
    const { repository, controller, first, second } =
      await libraryWithTwoDecks();

    await controller.renameDeck(first, "Alpha Renamed");

    expect(names(controller)).toEqual(["Alpha Renamed", "Bravo"]);
    /* Stored rather than held: the row the next mount reads carries the name. */
    const stored = await repository.load(first);
    expect(stored?.deck.name).toBe("Alpha Renamed");
    /* The deck that was open is untouched — the rename named another one. */
    expect((await repository.load(second))?.deck.name).toBe("Bravo");
    repository.close();
  });

  it("trims the name it is given", async () => {
    const { repository, controller, first } = await libraryWithTwoDecks();

    await controller.renameDeck(first, "   Spaced Out   ");

    expect((await repository.load(first))?.deck.name).toBe("Spaced Out");
    repository.close();
  });

  it("an invalid name posts a message and writes nothing", async () => {
    const { repository, controller, first } = await libraryWithTwoDecks();
    const before = (await repository.load(first))!.deck;

    await controller.renameDeck(first, "   ");

    expect(get(controller).message).toBe("Deck name is required");
    const after = (await repository.load(first))!.deck;
    expect(after.name).toBe(before.name);
    expect(after.revision).toBe(before.revision);
    repository.close();
  });

  it("renaming a deck storage no longer holds changes nothing", async () => {
    const { repository, controller } = await libraryWithTwoDecks();

    await controller.renameDeck(deckId("no-such-deck"), "Ghost");

    expect(names(controller)).toEqual(["Alpha", "Bravo"]);
    expect(get(controller).mode).not.toBe("error");
    repository.close();
  });
});
