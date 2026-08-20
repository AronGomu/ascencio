// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditor from "../../../src/deck-editor/components/DeckEditor.svelte";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import type { DeckCommand } from "../../../src/decks/deck-model.ts";
import {
  prototypeCatalogMap,
  stateFixture,
} from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

function props(onmutate: (command: DeckCommand) => void, mainCount = 0) {
  return {
    state: stateFixture(mainCount),
    cards: PROTOTYPE_CATALOG,
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
    onlibrary: vi.fn(),
    onrename: vi.fn(),
    onmutate,
    onundo: vi.fn(),
    onredo: vi.fn(),
    onretrysave: vi.fn(),
    onreload: vi.fn(),
    onpreservecopy: vi.fn(),
  };
}

describe("pointer deck editing", () => {
  it("drags catalog cards only to their canonical target", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    render(DeckEditor, props(onmutate));
    await fireEvent.dragStart(
      screen.getByRole("button", { name: /Blue-Eyes White Dragon/ }),
    );
    await fireEvent.drop(
      screen.getByRole("group", { name: "Main Deck drop area" }),
    );
    expect(onmutate).toHaveBeenCalledWith({ type: "add", cardCode: 89631139 });
  });

  it("moves deck cards to Side deck", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 1));
    const deckCard = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.dragStart(deckCard);
    await fireEvent.drop(
      screen.getByRole("group", { name: "Side Deck drop area" }),
    );
    expect(onmutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "move", from: "main", to: "side" }),
    );
  });

  it("ending a drag outside every zone removes the card", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 1));
    const deckCard = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.dragStart(deckCard);
    await fireEvent.dragEnd(deckCard);
    expect(onmutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "remove", zone: "main" }),
    );
  });

  it("dropping a main card on an illegal zone removes it", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 1));
    const deckCard = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.dragStart(deckCard);
    await fireEvent.drop(
      container.querySelector('[data-cy="deck-zone-drop-area-extra"]')!,
    );
    expect(onmutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "remove", zone: "main" }),
    );
  });

  it("dropping a catalog card on an illegal zone adds nothing", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate));
    const catalogCard = screen.getAllByRole("button", {
      name: /Blue-Eyes White Dragon/,
    })[0]!;
    await fireEvent.dragStart(catalogCard);
    await fireEvent.drop(
      container.querySelector('[data-cy="deck-zone-drop-area-extra"]')!,
    );
    expect(onmutate).not.toHaveBeenCalled();
  });

  it("an active drag paints illegal zones red and legal zones green", async () => {
    const { container } = render(DeckEditor, props(vi.fn(), 1));
    const deckCard = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.dragStart(deckCard);
    expect(
      container
        .querySelector('[data-cy="deck-zone-drop-area-main"]')!
        .classList.contains("allowed"),
    ).toBe(true);
    expect(
      container
        .querySelector('[data-cy="deck-zone-drop-area-extra"]')!
        .classList.contains("blocked"),
    ).toBe(true);
  });

  it("the pick helper buttons are gone", async () => {
    const { container } = render(DeckEditor, props(vi.fn(), 1));
    const deckCard = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.dragStart(deckCard);
    expect(
      container.querySelector('[data-cy="deck-workspace-remove-picked"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="deck-zone-drop-button-main"]'),
    ).toBeNull();
  });
});
