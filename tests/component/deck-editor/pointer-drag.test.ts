// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditor from "../../../src/deck-editor/components/DeckEditor.svelte";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import {
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import type { DeckBuilderState } from "../../../src/deck-editor/deck-editor-store.ts";
import type { DeckCommand } from "../../../src/decks/deck-model.ts";
import {
  prototypeCatalogMap,
  stateFixture,
} from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

const MAIN_LIMIT_3_CODES = PROTOTYPE_CATALOG.filter(
  (card) =>
    card.canonicalZone === "main" &&
    quantityLimit(PROTOTYPE_RULESET, card.code) === 3,
).map(({ code }) => code);

function stateWithMain(main: readonly number[]): DeckBuilderState {
  const base = stateFixture(0);
  return {
    ...base,
    current: {
      deck: { ...base.current!.deck, main },
      history: base.current!.history,
    },
  };
}

function props(
  onmutate: (command: DeckCommand) => void,
  mainCount = 0,
  state = stateFixture(mainCount),
) {
  return {
    state,
    cards: PROTOTYPE_CATALOG,
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
    returnLabel: "Deck Selection",
    onreturn: vi.fn(),
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
  it("drags catalog cards to their canonical target", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    render(DeckEditor, props(onmutate));
    await fireEvent.dragStart(
      screen.getByRole("button", { name: /Blue-Eyes White Dragon/ }),
    );
    await fireEvent.drop(
      screen.getByRole("group", { name: "Main Deck drop area" }),
    );
    expect(onmutate).toHaveBeenCalledWith({
      type: "add",
      cardCode: 89631139,
      zone: "main",
    });
  });

  it("moves deck cards to Side deck", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 1));
    await fireEvent.click(
      container.querySelector('[data-cy="deck-zone-toggle-side"]')!,
    );
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

  /* `remove` takes the index of the copy to drop and falls back to the first
     one without it. Left click and right click both send it; these two drag
     paths did not, so abandoning or misdropping the third copy of a card
     removed its first copy and left the tile under the pointer on screen. */
  it("ending a drag outside every zone removes the copy that was dragged", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const repeated = MAIN_LIMIT_3_CODES[0]!;
    const { container } = render(
      DeckEditor,
      props(
        onmutate,
        0,
        stateWithMain([repeated, MAIN_LIMIT_3_CODES[1]!, repeated]),
      ),
    );
    const deckCard = container.querySelector(
      '[data-cy="deck-slot-main-2"] button',
    )!;
    await fireEvent.dragStart(deckCard);
    await fireEvent.dragEnd(deckCard);
    expect(onmutate).toHaveBeenCalledWith({
      type: "remove",
      cardCode: repeated,
      zone: "main",
      index: 2,
    });
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

  it("dropping on an illegal zone removes the copy that was dragged", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const repeated = MAIN_LIMIT_3_CODES[0]!;
    const { container } = render(
      DeckEditor,
      props(
        onmutate,
        0,
        stateWithMain([repeated, MAIN_LIMIT_3_CODES[1]!, repeated]),
      ),
    );
    await fireEvent.dragStart(
      container.querySelector('[data-cy="deck-slot-main-2"] button')!,
    );
    await fireEvent.drop(
      container.querySelector('[data-cy="deck-zone-drop-area-extra"]')!,
    );
    expect(onmutate).toHaveBeenCalledWith({
      type: "remove",
      cardCode: repeated,
      zone: "main",
      index: 2,
    });
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
