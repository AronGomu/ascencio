// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
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

const MAIN_CODE = PROTOTYPE_CATALOG.find(
  (card) =>
    card.canonicalZone === "main" &&
    quantityLimit(PROTOTYPE_RULESET, card.code) === 3,
)!.code;
const EXTRA_CODE = PROTOTYPE_CATALOG.find(
  (card) => card.canonicalZone === "extra",
)!.code;

function stateWithExtra(): DeckBuilderState {
  const base = stateFixture(0);
  return {
    ...base,
    current: {
      deck: { ...base.current!.deck, extra: [EXTRA_CODE] },
      history: base.current!.history,
    },
  };
}

function props(
  onmutate: (command: DeckCommand) => void,
  state = stateFixture(0),
) {
  return {
    state,
    cards: PROTOTYPE_CATALOG,
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
    layoutMode: "panels" as const,
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

describe("desktop click editing", () => {
  it("clicking a main-deck card moves it to the side", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, stateFixture(1)));
    await fireEvent.click(
      container.querySelector('[data-cy="deck-slot-main-0"] button')!,
    );
    expect(onmutate).toHaveBeenCalledWith({
      type: "move",
      cardCode: MAIN_CODE,
      from: "main",
      to: "side",
    });
  });

  it("clicking an extra-deck card removes it", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, stateWithExtra()));
    await fireEvent.click(
      container.querySelector('[data-cy="deck-slot-extra-0"] button')!,
    );
    expect(onmutate).toHaveBeenCalledWith({
      type: "remove",
      cardCode: EXTRA_CODE,
      zone: "extra",
    });
  });

  it("clicking a catalog card adds it", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate));
    await fireEvent.click(
      container.querySelector(
        `[data-cy="deck-catalog-results"] [data-cy="deck-tile-${MAIN_CODE}"]`,
      )!,
    );
    expect(onmutate).toHaveBeenCalledWith({
      type: "add",
      cardCode: MAIN_CODE,
      zone: "main",
    });
  });

  it("the to-sideboard checkbox routes the add", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate));
    await fireEvent.click(
      container.querySelector('[data-cy="deck-catalog-to-sideboard"]')!,
    );
    await fireEvent.click(
      container.querySelector(
        `[data-cy="deck-catalog-results"] [data-cy="deck-tile-${MAIN_CODE}"]`,
      )!,
    );
    expect(onmutate).toHaveBeenCalledWith({
      type: "add",
      cardCode: MAIN_CODE,
      zone: "side",
    });
  });

  it("a catalog card can be dropped on the Side Deck", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate));
    await fireEvent.dragStart(
      container.querySelector(
        `[data-cy="deck-catalog-results"] [data-cy="deck-tile-${MAIN_CODE}"]`,
      )!,
    );
    expect(
      container
        .querySelector('[data-cy="deck-zone-drop-area-side"]')!
        .classList.contains("allowed"),
    ).toBe(true);
    await fireEvent.drop(
      container.querySelector('[data-cy="deck-zone-drop-area-side"]')!,
    );
    expect(onmutate).toHaveBeenCalledWith({
      type: "add",
      cardCode: MAIN_CODE,
      zone: "side",
    });
  });
});
