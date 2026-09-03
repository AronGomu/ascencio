// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import {
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { setRuntimeCatalogForTests } from "../../../src/decks/catalog/runtime-catalog.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import type { DeckContext } from "../../../src/decks/deck-repository-context.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { storyCardOwnership } from "../../../src/story/decks/card-ownership.ts";
import { createStoryDeckRepository } from "../../../src/story/decks/story-deck-repository.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";

/* The wire, not the rule: `tests/unit/decks/ownership-validation.test.ts` pins
   what `not-owned` means, and this pins that a story save's collection actually
   reaches the verdict the library paints. The two halves fail apart — a rule
   nobody passes ownership to is a rule that never fires, and a library row is
   the first place a player would notice (ADR-050).

   Driven through `DeckEditorApp` rather than the controller, because the
   ownership reader is resolved from the context inside the app; a test that
   handed the controller its own reader would pass with that resolution
   deleted. */

installPrototypeActiveCatalog();

const MAIN_CARDS = PROTOTYPE_CATALOG.filter(
  (card) =>
    card.canonicalZone === "main" &&
    quantityLimit(PROTOTYPE_RULESET, card.code) === 3,
);
/* Forty legal cards, so ownership is the only thing that can make this deck
   illegal: a size or copy-limit error would badge the row on its own and prove
   nothing about the collection. */
const MAIN = Array.from(
  { length: 40 },
  (_, index) => MAIN_CARDS[index % MAIN_CARDS.length]!.code,
);
const SOLD = MAIN_CARDS[6]!;
const STORY_DECK_ID = "story-legality-deck";

setRuntimeCatalogForTests(PROTOTYPE_CATALOG);

afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

function collectionOf(codes: readonly number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const code of codes) counts[code] = (counts[code] ?? 0) + 1;
  return counts;
}

/** A save holding one forty-card deck and the collection handed in, wired as
    `openStoryDeckContext` wires a real one: repository and ownership read off
    the same state. */
function storyContext(
  collection: Readonly<Record<number, number>>,
): DeckContext {
  const deck = storyDeckFixture(STORY_DECK_ID, { main: MAIN });
  let state: StoryState = {
    ...createInitialStoryState(),
    screen: "map",
    savedScreen: "map",
    progressExists: true,
    collection,
    decks: [deck],
    defaultDeckId: deck.id,
  };
  return Object.freeze({
    kind: "story",
    label: "Legality",
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
  });
}

async function openLibrary(collection: Record<number, number>): Promise<void> {
  render(DeckEditorApp, {
    props: {
      deckId: null,
      onnavigate: vi.fn(),
      context: storyContext(collection),
    },
  });
  await waitFor(() =>
    expect(
      document.querySelector('[data-cy="deck-select-grid"]'),
    ).not.toBeNull(),
  );
}

/** Press surface: deck save cannot field remains unpickable. */
function press(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `[data-cy="deck-tile-press-${STORY_DECK_ID}"]`,
  );
}

/** One concise tile line carries availability and concrete reason. */
function reason(): string {
  return (
    document.querySelector(`[data-cy="deck-tile-tags-${STORY_DECK_ID}"]`)
      ?.textContent ?? ""
  );
}

describe("ownership legality in the deck library", () => {
  /* Nobody edited this deck. The save sold a card out from under it, which is
     the case T26 warns about before it commits and T27 refuses a duel for. */
  /* Ownership is the only thing wrong with this deck, so "Cards not owned" is
     reachable at all only if the save's collection reached the verdict: a
     build-rule error would read "Illegal", and no error at all would leave the
     tile pickable and unbadged. Which card was sold is named in the editor's
     validation panel rather than on the tile, which carries one line. */
  it("a deck using a card the save sold is badged illegal and says why", async () => {
    const collection = collectionOf(MAIN);
    await openLibrary({ ...collection, [SOLD.code]: 0 });

    expect(reason()).toContain("Illegal");
    expect(reason()).toContain("Cards not owned");
    expect(press()?.disabled).toBe(true);
  });

  it("the same deck is legal while the save still owns its cards", async () => {
    await openLibrary(collectionOf(MAIN));

    expect(reason()).not.toContain("Illegal");
    expect(reason()).toBe("Local deck");
    expect(press()?.disabled).toBe(false);
  });
});
