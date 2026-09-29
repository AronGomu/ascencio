// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditor from "../../../src/deck-editor/components/DeckEditor.svelte";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";
import {
  prototypeCatalogMap,
  stateFixture,
} from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

function renderEditor() {
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
    ondelete: vi.fn(),
  });
}

describe("deck delete dialog focus", () => {
  it("moves focus into the confirmation dialog when it opens", async () => {
    renderEditor();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: /Delete .*\?/ }),
    );
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
  });
});
