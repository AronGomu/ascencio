// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import type { DeckContext } from "../../../src/decks/deck-repository-context.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import { STARTER_DECK_NAME } from "../../../src/decks/starter-deck.ts";
import { storyCardOwnership } from "../../../src/story/decks/card-ownership.ts";
import { createStoryDeckRepository } from "../../../src/story/decks/story-deck-repository.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
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

/** A save with no decks and no default — what a player is left with after
    deleting the deck that was default, and what a pre-v3 save migrates to.
    Wired as `openStoryDeckContext` wires a real one: repository and ownership
    read off the one state. */
function emptyStoryContext(): {
  readonly context: DeckContext;
  readonly state: () => StoryState;
} {
  let state: StoryState = {
    ...createInitialStoryState(),
    screen: "map",
    savedScreen: "map",
    progressExists: true,
    decks: [],
    defaultDeckId: null,
  };
  return {
    context: Object.freeze({
      kind: "story",
      label: "Empty save",
      ownership: storyCardOwnership(state),
      createRepository: () =>
        createStoryDeckRepository({
          readState: () => state,
          dispatch: (command) => {
            state = reduceStory(state, command);
          },
          restore: (previous) => {
            state = previous;
          },
          persist: () => Promise.resolve(),
        }),
    }),
    state: () => state,
  };
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
      '[data-cy^="deck-tile-badge-default-"]',
    );
    expect(badge?.textContent).toContain("Default");
    expect(
      badge?.closest("article")?.querySelector('[data-cy^="deck-tile-name-"]')
        ?.textContent,
    ).toBe(STARTER_DECK_NAME);
    expect(await libraryRowNames()).toEqual([STARTER_DECK_NAME]);
  });

  /* The story's one grant path is `new-game`, which hands over the deck and the
     cards behind it together. Seeding here would write a deck whose forty cards
     the save does not own — badged `not-owned` and refused at pre-battle, so
     the player's only deck would be one they cannot duel with (ADR-050). */
  it("a story save with no decks is not seeded one it cannot own", async () => {
    const { context, state } = emptyStoryContext();
    render(DeckEditorApp, {
      props: { deckId: null, onnavigate: vi.fn(), context },
    });
    await waitFor(() =>
      expect(document.querySelector('[data-cy="deck-library"]')).not.toBeNull(),
    );

    expect(state().decks.map(({ name }) => name)).toEqual([]);
    expect(state().defaultDeckId).toBeNull();
    expect(state().collection).toEqual(createInitialStoryState().collection);
    expect(
      document.querySelector('[data-cy="deck-library-empty"]'),
    ).not.toBeNull();
  });

  /* Nothing is seeded, so the empty library is the whole offer: it has to be
     able to make the first deck rather than leave the player with none. */
  it("a story save with no decks can still build its first one", async () => {
    const user = userEvent.setup();
    const { context, state } = emptyStoryContext();
    render(DeckEditorApp, {
      props: { deckId: null, onnavigate: vi.fn(), context },
    });
    await waitFor(() =>
      expect(
        document.querySelector('[data-cy="deck-library-empty-create"]'),
      ).not.toBeNull(),
    );

    await user.click(
      document.querySelector<HTMLElement>(
        '[data-cy="deck-library-empty-create"]',
      )!,
    );
    await user.type(
      document.querySelector<HTMLElement>(
        '[data-cy="deck-library-create-name-input"]',
      )!,
      "First Deck",
    );
    await user.click(
      document.querySelector<HTMLElement>(
        '[data-cy="deck-library-create-submit"]',
      )!,
    );

    await waitFor(() =>
      expect(state().decks.map(({ name }) => name)).toEqual(["First Deck"]),
    );
  });

  it("a second visit does not add a second starter deck", async () => {
    const first = render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    await waitFor(() =>
      expect(
        document.querySelector('[data-cy^="deck-tile-badge-default-"]'),
      ).not.toBeNull(),
    );
    first.unmount();

    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    await waitFor(() =>
      expect(
        document.querySelector('[data-cy^="deck-tile-badge-default-"]'),
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
