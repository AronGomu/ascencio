// @vitest-environment jsdom

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
} from "@testing-library/svelte";
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
  (c) =>
    c.canonicalZone === "main" &&
    quantityLimit(PROTOTYPE_RULESET, c.code) === 3,
).map((c) => c.code);

function stateWith(mainCount: number, sideCount: number): DeckBuilderState {
  const base = stateFixture(mainCount);
  const sideCards = Array.from(
    { length: sideCount },
    (_, i) => MAIN_LIMIT_3_CODES[i % MAIN_LIMIT_3_CODES.length]!,
  );
  return {
    ...base,
    current: {
      deck: { ...base.current!.deck, side: sideCards },
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

describe("context-menu deck editing", () => {
  it("right-click on a main-deck card removes one copy", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, stateFixture(1)));
    const deckCard = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.contextMenu(deckCard);
    expect(onmutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "remove", zone: "main" }),
    );
  });

  it("right-click on a catalog card adds it to its canonical zone", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate));
    const catalogTile = container.querySelector(
      `[data-cy="deck-catalog-results"] [data-cy="deck-tile-${MAIN_LIMIT_3_CODES[0]!}"]`,
    )!;
    await fireEvent.contextMenu(catalogTile);
    expect(onmutate).toHaveBeenCalledWith({
      type: "add",
      cardCode: MAIN_LIMIT_3_CODES[0]!,
      zone: "main",
    });
  });

  it("right-click on a catalog monster with a full main deck adds to the side deck", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, stateFixture(60)));
    const catalogTile = container.querySelector(
      `[data-cy="deck-catalog-results"] [data-cy="deck-tile-${MAIN_LIMIT_3_CODES[0]!}"]`,
    )!;
    await fireEvent.contextMenu(catalogTile);
    expect(onmutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "add", zone: "side" }),
    );
  });

  it("right-click adds nothing when side is also full", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(
      DeckEditor,
      props(onmutate, stateWith(60, 15)),
    );
    const catalogTile = container.querySelector(
      `[data-cy="deck-catalog-results"] [data-cy="deck-tile-${MAIN_LIMIT_3_CODES[0]!}"]`,
    )!;
    await fireEvent.contextMenu(catalogTile);
    expect(onmutate).not.toHaveBeenCalled();
  });

  it("the browser context menu is suppressed on tiles", async () => {
    const { container } = render(DeckEditor, props(vi.fn()));
    const catalogTile = container.querySelector(
      '[data-cy="deck-catalog-results"] button',
    )!;
    const event = createEvent.contextMenu(catalogTile);
    fireEvent(catalogTile, event);
    expect(event.defaultPrevented).toBe(true);
  });
});
