// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import DeckEditor from "../../../src/deck-editor/components/DeckEditor.svelte";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_DECK_DATABASE_NAME } from "../../../src/decks/indexeddb-deck-repository.ts";
import {
  prototypeCatalogMap,
  stateFixture,
} from "../../fixtures/deck-editor.ts";

afterEach(async () => {
  cleanup();
  await deleteDB(PROTOTYPE_DECK_DATABASE_NAME);
});

function renderEditor(mainCount = 0) {
  return render(DeckEditor, {
    state: stateFixture(mainCount),
    cards: PROTOTYPE_CATALOG,
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
    onlibrary: vi.fn(),
    onrename: vi.fn(),
    onmutate: vi.fn(),
    onundo: vi.fn(),
    onredo: vi.fn(),
    onretrysave: vi.fn(),
    onreload: vi.fn(),
    onpreservecopy: vi.fn(),
  });
}

describe("DeckEditor shell", () => {
  it("renders fixed Catalog, Deck, pinned Details topology", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "Find cards" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Build deck" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Select a card" })).toBeTruthy();
    expect(screen.getByLabelText("Deck counts").textContent).toContain(
      "Main 0",
    );
    expect(
      screen.queryByRole("button", { name: /Use deck|Select deck/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /compact|list view/i }),
    ).toBeNull();
  });

  it("keeps save state separate from deck validity", () => {
    renderEditor();
    expect(screen.getByText("Saved locally")).toBeTruthy();
    expect(screen.getByText("errors")).toBeTruthy();
  });

  it("shows the empty-catalog state from real filters, not a fixture switch", async () => {
    renderEditor();
    const search = screen.getByRole("searchbox", { name: "Name" });
    await userEvent.setup().type(search, "no-such-card");
    expect(
      screen.getByRole("heading", { name: "No matching cards" }),
    ).toBeTruthy();
  });
});

/* Ported from the deleted prototype-shell test: the domain root has to paint
   the loading skeleton off its own storage and settle on the library, with no
   reviewer harness anywhere in the tree. */
describe("DeckEditorApp boot", () => {
  it("loads isolated storage then falls back to Deck Library", async () => {
    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });
    expect(
      screen.getByRole("heading", { name: /Loading local decks/i }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Deck Library" }),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/Session status/i)).toBeNull();
    expect(screen.queryByText(/Prototype review states/i)).toBeNull();
  });
});
