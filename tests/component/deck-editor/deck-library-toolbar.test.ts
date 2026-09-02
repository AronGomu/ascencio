// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import { deckFixture } from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

function callbacks() {
  return {
    oncreate: vi.fn(),
    onopen: vi.fn(),
    onimport: vi.fn(),
  };
}

describe("DeckLibrary toolbar layout", () => {
  /* Filter and sort belong to every deck grid, so they live in the shared
     screen's own tools row. What is left here is what only this library has:
     the collection and YDK import. */
  it("collection and import share the library's tools row", () => {
    render(DeckLibrary, { decks: [deckFixture()], ...callbacks() });
    const toolsRow = document.querySelector('[data-cy="deck-library-tools"]');
    expect(toolsRow).not.toBeNull();
    for (const cy of ["deck-library-collection", "deck-library-import"]) {
      const el = document.querySelector(`[data-cy="${cy}"]`);
      expect(el, `${cy} should exist`).not.toBeNull();
      expect(
        el!.closest('[data-cy="deck-library-tools"]'),
        `${cy} should be inside deck-library-tools`,
      ).not.toBeNull();
    }
  });

  /* Making a deck is one offer, and the shared footer is where it is made:
     a second button of the library's own would say the same thing twice. */
  it("the screen's footer holds the library's only create control", () => {
    render(DeckLibrary, { decks: [deckFixture()], ...callbacks() });
    const creates = [...document.querySelectorAll("button")].filter((el) =>
      /create/i.test(el.textContent ?? ""),
    );
    expect(creates.map((el) => el.getAttribute("data-cy"))).toEqual([
      "deck-select-create",
    ]);
    expect(
      creates[0]!.closest('[data-cy="deck-select-footer"]'),
      "create belongs to the shared screen's footer",
    ).not.toBeNull();
  });

  it("the filter and the sort come from the shared screen", () => {
    render(DeckLibrary, { decks: [deckFixture()], ...callbacks() });
    for (const cy of ["deck-select-filter", "deck-select-sort"]) {
      const el = document.querySelector(`[data-cy="${cy}"]`);
      expect(el, `${cy} should exist`).not.toBeNull();
      expect(
        el!.closest('[data-cy="deck-library-tools"]'),
        `${cy} belongs to the screen, not the library's own tools row`,
      ).toBeNull();
    }
  });

  it("the default badge sits on the deck tile's badge row", () => {
    const deck = deckFixture();
    render(DeckLibrary, {
      decks: [deck],
      defaultDeckId: deck.id,
      ...callbacks(),
    });
    const badge = document.querySelector(
      `[data-cy="deck-tile-badge-default-${deck.id}"]`,
    );
    expect(badge, "default badge should exist").not.toBeNull();
    expect(
      badge!.parentElement?.getAttribute("data-cy"),
      "badge parent should be the tile's badge row",
    ).toBe(`deck-tile-badges-${deck.id}`);
    const nameEl = document.querySelector(
      `[data-cy="deck-tile-name-${deck.id}"]`,
    );
    expect(nameEl, "name element should exist").not.toBeNull();
    expect(
      nameEl!.closest(`[data-cy="deck-tile-${deck.id}"]`),
      "name should be inside the same tile the badge is on",
    ).not.toBeNull();
  });
});
