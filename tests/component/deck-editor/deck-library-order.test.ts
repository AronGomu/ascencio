// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import type { DeckId, DeckRecord } from "../../../src/decks/deck-contracts.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

function deck(id: string, name: string, updatedAt: string): DeckRecord {
  const base = createBlankDeck(name, prototypeCatalogMap, PROTOTYPE_RULESET, {
    id,
    now: new Date(updatedAt),
  });
  return Object.freeze({ ...base, revision: 1 });
}

/* The rendered order, read off the grid rather than recomputed: the point of
   these cases is that the DOM says what the shared screen's `orderDeckTiles`
   decided, which is the one link a pure ordering test cannot see. */
function renderedNames(): readonly string[] {
  return [
    ...document.querySelectorAll(
      '[data-cy="deck-select-grid"] > [data-cy^="deck-tile-"]',
    ),
  ].map(
    (tile) =>
      tile.querySelector('[data-cy^="deck-tile-name-"]')?.textContent ?? "",
  );
}

const OLDEST = deck("d-oldest", "Charlie", "2026-01-01T00:00:00.000Z");
const MIDDLE = deck("d-middle", "Alpha", "2026-02-01T00:00:00.000Z");
const NEWEST = deck("d-newest", "Bravo", "2026-03-01T00:00:00.000Z");
const DEFAULT = deck("d-default", "Delta", "2025-01-01T00:00:00.000Z");

function renderLibrary(props: Record<string, unknown> = {}) {
  return render(DeckLibrary, {
    decks: [OLDEST, MIDDLE, NEWEST, DEFAULT],
    oncreate: vi.fn(),
    onopen: vi.fn(),
    onimport: vi.fn(),
    ...props,
  });
}

describe("the library renders decks in order", () => {
  /* `Delta` is the stalest deck by a year, so it can only lead by being the
     default. Every remaining deck follows `updatedAt`. */
  it("the default leads, then the rest sort by last modified", () => {
    renderLibrary({ defaultDeckId: DEFAULT.id });
    expect(renderedNames()).toEqual(["Delta", "Bravo", "Alpha", "Charlie"]);
  });

  it("without a default the decks sort by last modified", () => {
    renderLibrary();
    expect(renderedNames()).toEqual(["Bravo", "Alpha", "Charlie", "Delta"]);
  });

  /* The sort control is wired to the rendered tiles and not only present: the
     alphabetical order differs, while the default keeps its first place. */
  it("choosing Name re-sorts the tiles the library renders", async () => {
    renderLibrary({ defaultDeckId: DEFAULT.id });
    expect(renderedNames()).toEqual(["Delta", "Bravo", "Alpha", "Charlie"]);

    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "Sort" }), "name");

    expect(renderedNames()).toEqual(["Delta", "Alpha", "Bravo", "Charlie"]);
  });

  it("a filter narrows the tiles but keeps the order", async () => {
    renderLibrary();
    await userEvent
      .setup()
      .type(screen.getByRole("searchbox", { name: "Filter" }), "l");

    expect(renderedNames()).toEqual(["Alpha", "Charlie", "Delta"]);
  });
});

describe("set default from the deck page", () => {
  /* Nothing but this asserts that the button does anything: the library's own
     version of the action was deleted when it moved to the deck page, and its
     replacement checks only that the button exists and is disabled on the deck
     that already is default. `DeckEditorApp` wires it to
     `controller.setDefaultDeck`, so the proof is the stored default. */
  it("the button stores the open deck as the default", async () => {
    const chosen = deck("d-chosen", "Chosen Deck", "2026-01-01T00:00:00.000Z");
    const repository = await IndexedDbDeckRepository.open();
    await repository.create(chosen, emptyDeckHistory());
    repository.close();

    render(DeckEditorApp, {
      deckId: chosen.id as DeckId,
      onnavigate: vi.fn(),
    });
    await waitFor(() =>
      expect(
        document.querySelector('[data-cy="deck-editor-set-default"]'),
      ).not.toBeNull(),
    );

    const button = document.querySelector<HTMLButtonElement>(
      '[data-cy="deck-editor-set-default"]',
    )!;
    /* The starter deck seeded on mount holds the default, so this deck does
       not: the button is live and the stored default is somebody else. */
    await waitFor(() => expect(button.disabled).toBe(false));

    await userEvent.setup().click(button);

    /* Making a deck the default changes no deck, so the deck stays open.
       `setDefaultDeck` used to re-read the whole library, which sets `mode` to
       `library` and `current` to `null`: the deck closed under the button and
       the route had already been applied, so nothing re-opened it and the
       editor sat on "Opening deck…" until a reload. */
    expect(
      document.querySelector('[data-cy="deck-editor-opening"]'),
      "Set default must not close the deck it is called from",
    ).toBeNull();
    expect(
      document.querySelector<HTMLInputElement>('[data-cy="deck-name-input"]')
        ?.value,
    ).toBe("Chosen Deck");

    /* The editor believes it, so a second click cannot re-issue it. */
    await waitFor(() =>
      expect(
        document.querySelector<HTMLButtonElement>(
          '[data-cy="deck-editor-set-default"]',
        )?.disabled,
      ).toBe(true),
    );

    /* Stored, not held: fresh mount reads filled disabled star back. */
    cleanup();
    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    await waitFor(() =>
      expect(
        document.querySelector(
          `[data-cy="deck-tile-default-star-${chosen.id}"][disabled]`,
        ),
      ).not.toBeNull(),
    );
    expect(
      document
        .querySelector('[aria-label="Default deck"]')
        ?.getAttribute("data-cy"),
    ).toBe(`deck-tile-default-star-${chosen.id}`);
  });
});
