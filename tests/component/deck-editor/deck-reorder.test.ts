// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
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

describe("drag reordering", () => {
  it("dragging a main card onto another swaps their slots", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 3));
    const card0 = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.dragStart(card0);
    const slot2 = container.querySelector('[data-cy="deck-slot-main-2"]')!;
    await fireEvent.drop(slot2);
    expect(onmutate).toHaveBeenCalledWith({
      type: "reorder",
      zone: "main",
      from: 0,
      to: 2,
    });
  });

  it("dropping a main card on an empty slot moves it to the end", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 2));
    const card0 = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.dragStart(card0);
    const emptySlot = container.querySelector(
      '[data-cy="deck-zone-empty-slot-main-0"]',
    )!;
    await fireEvent.drop(emptySlot);
    expect(onmutate).toHaveBeenCalledWith({
      type: "reorder",
      zone: "main",
      from: 0,
      to: 2,
    });
  });

  it("a reorder leaves undo disabled", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 3));
    const card0 = container.querySelector(
      '[data-cy="deck-slot-main-0"] button',
    )!;
    await fireEvent.dragStart(card0);
    await fireEvent.drop(
      container.querySelector('[data-cy="deck-slot-main-2"]')!,
    );
    const undoButton = container.querySelector<HTMLButtonElement>(
      '[data-cy="deck-editor-undo"]',
    )!;
    expect(undoButton.disabled).toBe(true);
  });
});

describe("sort actions toolbar", () => {
  it("offers one Sort By select with all seven modes", () => {
    const { container } = render(DeckEditor, props(vi.fn(), 3));
    const select = container.querySelector<HTMLSelectElement>(
      '[data-cy="deck-workspace-sort-mode"]',
    )!;

    expect([...select.options].map(({ text }) => text)).toEqual([
      "Sort By",
      "A–Z",
      "CardType>A–Z",
      "Level>CardType>A–Z",
      "Attribute>CardType>A–Z",
      "MonsterType>CardType>A–Z",
      "ATK>CardType>A–Z",
      "DEF>CardType>A–Z",
    ]);
    expect(
      container.querySelector('[data-cy="deck-workspace-sort-alpha"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="deck-workspace-sort-type"]'),
    ).toBeNull();
  });

  it("selecting a mode immediately dispatches an ascending sort", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 3));
    const select = container.querySelector<HTMLSelectElement>(
      '[data-cy="deck-workspace-sort-mode"]',
    )!;

    await fireEvent.change(select, { target: { value: "level" } });

    expect(onmutate).toHaveBeenCalledWith({
      type: "sort",
      mode: "level",
      direction: "asc",
    });
  });

  it("direction toggle re-applies current mode and names its next action", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 3));
    const select = container.querySelector<HTMLSelectElement>(
      '[data-cy="deck-workspace-sort-mode"]',
    )!;
    const direction = container.querySelector<HTMLButtonElement>(
      '[data-cy="deck-workspace-sort-direction"]',
    )!;

    expect(direction.disabled).toBe(true);
    expect(direction.getAttribute("aria-label")).toBe("Sort descending");
    await fireEvent.change(select, { target: { value: "race" } });
    expect(direction.disabled).toBe(false);
    await fireEvent.click(direction);

    expect(direction.getAttribute("aria-label")).toBe("Sort ascending");
    expect(onmutate).toHaveBeenLastCalledWith({
      type: "sort",
      mode: "race",
      direction: "desc",
    });
  });
});
