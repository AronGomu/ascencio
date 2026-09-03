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

const BLUE_EYES = 89631139;

afterEach(() => cleanup());

function renderEditor(mainCount = 0) {
  const onmutate = vi.fn<(command: DeckCommand) => void>();
  const result = render(DeckEditor, {
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
  });
  return { ...result, onmutate };
}

function catalogTile(container: HTMLElement): HTMLElement {
  return container.querySelector(`[data-cy="catalog-tile-${BLUE_EYES}"]`)!;
}

describe("deck editor click semantics", () => {
  it("single-click pins a catalog card without changing the deck", async () => {
    const { container, onmutate } = renderEditor();
    const tile = catalogTile(container);

    await fireEvent.click(tile);

    expect(tile.getAttribute("aria-pressed")).toBe("true");
    expect(
      container.querySelector('[data-cy="card-preview-name"]')?.textContent,
    ).toContain("Blue-Eyes White Dragon");
    expect(onmutate).not.toHaveBeenCalled();
  });

  it("one catalog double-click sequence adds exactly one copy", async () => {
    const { container, onmutate } = renderEditor();
    const tile = catalogTile(container);

    await fireEvent.click(tile);
    await fireEvent.click(tile);
    await fireEvent.dblClick(tile);

    expect(onmutate).toHaveBeenCalledTimes(1);
    expect(onmutate).toHaveBeenCalledWith({
      type: "add",
      cardCode: BLUE_EYES,
      zone: "main",
    });
  });

  it("one main-deck double-click sequence removes instead of sideboarding", async () => {
    const { container, onmutate } = renderEditor(1);
    const tile = container.querySelector<HTMLElement>(
      '[data-cy="deck-slot-main-0"] button',
    )!;

    await fireEvent.click(tile);
    await fireEvent.click(tile);
    await fireEvent.dblClick(tile);

    expect(onmutate).toHaveBeenCalledTimes(1);
    expect(onmutate).toHaveBeenCalledWith({
      type: "remove",
      cardCode: BLUE_EYES,
      zone: "main",
      index: 0,
    });
  });
});
