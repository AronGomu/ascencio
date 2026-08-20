// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import { deckFixture } from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

describe("Deck Library CRUD", () => {
  it("creates blank decks", async () => {
    const user = userEvent.setup();
    const deck = deckFixture();
    const oncreate = vi.fn();
    render(DeckLibrary, {
      decks: [deck],
      oncreate,
      onopen: vi.fn(),
      onimport: vi.fn(),
    });
    await user.click(screen.getByRole("button", { name: "Create deck" }));
    await user.type(screen.getByLabelText("Deck name"), "Blank first");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(oncreate).toHaveBeenCalledWith("Blank first");
  });
});
