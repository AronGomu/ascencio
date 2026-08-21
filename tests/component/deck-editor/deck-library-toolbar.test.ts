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
  it("search, sort, collection, import and create share the tools row", () => {
    render(DeckLibrary, { decks: [deckFixture()], ...callbacks() });
    const toolsRow = document.querySelector('[data-cy="deck-library-tools"]');
    expect(toolsRow).not.toBeNull();
    for (const cy of [
      "deck-library-search-field",
      "deck-library-sort-field",
      "deck-library-collection",
      "deck-library-import",
      "deck-library-create",
    ]) {
      const el = document.querySelector(`[data-cy="${cy}"]`);
      expect(el, `${cy} should exist`).not.toBeNull();
      expect(
        el!.closest('[data-cy="deck-library-tools"]'),
        `${cy} should be inside deck-library-tools`,
      ).not.toBeNull();
    }
  });

  it("the default badge sits on the deck name line", () => {
    const deck = deckFixture();
    render(DeckLibrary, {
      decks: [deck],
      defaultDeckId: deck.id,
      ...callbacks(),
    });
    const badge = document.querySelector(
      `[data-cy="deck-library-default-badge-${deck.id}"]`,
    );
    expect(badge, "default badge should exist").not.toBeNull();
    const parent = badge!.parentElement;
    expect(
      parent?.getAttribute("data-cy"),
      "badge parent should be row-title",
    ).toBe(`deck-library-row-title-${deck.id}`);
    const nameEl = document.querySelector(
      `[data-cy="deck-library-name-${deck.id}"]`,
    );
    expect(nameEl, "name element should exist").not.toBeNull();
    expect(
      nameEl!.closest(`[data-cy="deck-library-row-title-${deck.id}"]`),
      "name should be inside the same row-title span",
    ).not.toBeNull();
  });
});
