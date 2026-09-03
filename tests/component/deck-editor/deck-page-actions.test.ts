// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditor from "../../../src/deck-editor/components/DeckEditor.svelte";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import {
  deckFixture,
  prototypeCatalogMap,
  stateFixture,
} from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

function renderEditor(overrides: Partial<Record<string, unknown>> = {}) {
  return render(DeckEditor, {
    state: stateFixture(1),
    cards: PROTOTYPE_CATALOG,
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
    returnLabel: "Deck Selection",
    onreturn: vi.fn(),
    onrename: vi.fn(),
    onmutate: vi.fn(),
    onundo: vi.fn(),
    onredo: vi.fn(),
    onretrysave: vi.fn(),
    onreload: vi.fn(),
    onpreservecopy: vi.fn(),
    onduplicate: vi.fn(),
    onexport: vi.fn(),
    onsetdefault: vi.fn(),
    ondelete: vi.fn(),
    ...overrides,
  });
}

describe("Deck page actions", () => {
  it("the deck page offers duplicate, export, set default and delete", () => {
    renderEditor();
    expect(
      document.querySelector('[data-cy="deck-editor-duplicate"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="deck-editor-export"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="deck-editor-set-default"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="deck-editor-delete"]'),
    ).not.toBeNull();
  });

  it("set default is disabled for the deck that already is default", () => {
    const state = stateFixture(1);
    renderEditor({ state, defaultDeckId: state.current!.deck.id });
    const btn = document.querySelector<HTMLButtonElement>(
      '[data-cy="deck-editor-set-default"]',
    )!;
    expect(btn.disabled).toBe(true);
  });

  it("delete asks before it deletes", async () => {
    const ondelete = vi.fn();
    renderEditor({ ondelete });
    const user = userEvent.setup();
    await user.click(document.querySelector('[data-cy="deck-editor-delete"]')!);
    expect(
      document.querySelector('[data-cy="deck-editor-delete-dialog"]'),
    ).not.toBeNull();
    expect(ondelete).not.toHaveBeenCalled();
    await user.click(
      document.querySelector('[data-cy="deck-editor-delete-confirm"]')!,
    );
    expect(ondelete).toHaveBeenCalledOnce();
  });

  /* Rename, duplicate and delete came back to the library with the shared deck
     grid, but on each tile's own kebab rather than as a row of inline buttons —
     and export and set-default stayed on the deck page. */
  it("the library tile carries its actions on the kebab, not inline", () => {
    const deck = deckFixture();
    render(DeckLibrary, {
      decks: [deck],
      oncreate: vi.fn(),
      onopen: vi.fn(),
      onimport: vi.fn(),
    });
    expect(
      document.querySelector(`[data-cy="deck-tile-menu-${deck.id}"]`),
    ).not.toBeNull();
    expect(
      document.querySelector(`[data-cy="deck-library-rename-${deck.id}"]`),
    ).toBeNull();
    expect(
      document.querySelector(`[data-cy="deck-library-duplicate-${deck.id}"]`),
    ).toBeNull();
    expect(
      document.querySelector(`[data-cy="deck-library-export-${deck.id}"]`),
    ).toBeNull();
    expect(
      document.querySelector(`[data-cy="deck-library-delete-${deck.id}"]`),
    ).toBeNull();
    expect(
      document.querySelector(`[data-cy="deck-library-set-default-${deck.id}"]`),
    ).toBeNull();
  });
});
