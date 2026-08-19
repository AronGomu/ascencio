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
  it("sort a-z calls sort alpha command", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 3));
    await fireEvent.click(
      container.querySelector('[data-cy="deck-workspace-sort-alpha"]')!,
    );
    expect(onmutate).toHaveBeenCalledWith({ type: "sort", mode: "alpha" });
  });

  it("sort by type calls sort type command", async () => {
    const onmutate = vi.fn<(command: DeckCommand) => void>();
    const { container } = render(DeckEditor, props(onmutate, 3));
    await fireEvent.click(
      container.querySelector('[data-cy="deck-workspace-sort-type"]')!,
    );
    expect(onmutate).toHaveBeenCalledWith({ type: "sort", mode: "type" });
  });
});
