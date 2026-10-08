// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardCatalog from "../../../src/deck-editor/components/CardCatalog.svelte";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";

afterEach(() => cleanup());

describe("CardCatalog", () => {
  it("combines compact Name and Types filters with AND", async () => {
    const user = userEvent.setup();
    render(CardCatalog, {
      cards: PROTOTYPE_CATALOG,
      ruleset: PROTOTYPE_RULESET,
      onselect: vi.fn(),
      ondragcard: vi.fn(),
    });
    const name = screen.getByRole("searchbox", { name: "Name" });
    expect(name.getAttribute("placeholder")).toBe("Name");
    const types = await screen.findByRole("combobox", { name: "Types" });
    expect(types).toBeTruthy();
    expect(
      document.querySelector('[data-cy="deck-catalog-name-label"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="deck-catalog-family-select"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="deck-catalog-subtype-select"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="deck-catalog-attribute-select"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="deck-catalog-race-select"]'),
    ).toBeNull();

    await user.type(name, "dark");
    await user.type(types, "spellcaster{Enter}");
    expect(screen.getByText("1 results")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dark Magician/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Dark Hole/ })).toBeNull();
    expect(
      document.querySelector('[data-cy="deck-catalog-filter-summary"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="deck-catalog-results-region"]'),
    ).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText(/23 results/)).toBeTruthy();
  });

  it("updates pinned selection callback without adding on click", async () => {
    const onselect = vi.fn();
    const ondragcard = vi.fn();
    render(CardCatalog, {
      cards: PROTOTYPE_CATALOG,
      ruleset: PROTOTYPE_RULESET,
      onselect,
      ondragcard,
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Raigeki/ }));
    expect(onselect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Raigeki" }),
    );
    expect(ondragcard).not.toHaveBeenCalled();
  });
});
