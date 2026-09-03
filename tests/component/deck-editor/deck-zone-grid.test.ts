// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckZoneGrid from "../../../src/deck-editor/components/DeckZoneGrid.svelte";
import DeckWorkspace from "../../../src/deck-editor/components/DeckWorkspace.svelte";
import {
  FIFTEEN_CARD_GRID,
  mainDeckGridPlan,
} from "../../../src/decks/deck-model.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import {
  deckFixture,
  prototypeCatalogMap,
} from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

describe("DeckZoneGrid", () => {
  it("renders repeated tiles plus 40 explicit slots through card 40", () => {
    const codes = [89631139, 89631139, 89631139];
    const { container } = render(DeckZoneGrid, {
      zone: "main",
      label: "Main Deck",
      codes,
      plan: mainDeckGridPlan(codes.length),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
      totalCopies: new Map([[89631139, 3]]),
      onselect: vi.fn(),
      ondragcard: vi.fn(),
      ondropzone: vi.fn(),
    });
    expect(
      screen.getAllByRole("button", { name: /Blue-Eyes White Dragon/ }),
    ).toHaveLength(3);
    expect(container.querySelector('[data-slots="40"]')).toBeTruthy();
    expect(container.querySelector('[data-columns="10"]')).toBeTruthy();
    expect(
      container.querySelectorAll('[data-cy^="deck-zone-empty-slot-main-"]'),
    ).toHaveLength(37);
  });

  it("switches to 50 slots at card 41", () => {
    const codes = Array.from({ length: 41 }, () => 89631139);
    const { container } = render(DeckZoneGrid, {
      zone: "main",
      label: "Main Deck",
      codes,
      plan: mainDeckGridPlan(codes.length),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
      totalCopies: new Map([[89631139, 41]]),
    });
    expect(container.querySelector('[data-slots="50"]')).toBeTruthy();
    expect(container.querySelector('[data-columns="10"]')).toBeTruthy();
  });
});

describe("DeckZoneGrid collapsible zones", () => {
  it("starts with only the side deck collapsed", () => {
    const { container } = render(DeckWorkspace, {
      deck: deckFixture(0),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
    });
    expect(container.querySelector("#deck-zone-body-main")).not.toBeNull();
    expect(container.querySelector("#deck-zone-body-extra")).not.toBeNull();
    expect(container.querySelector("#deck-zone-body-side")).toBeNull();
    expect(
      container
        .querySelector('[data-cy="deck-zone-toggle-side"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("toggles the side deck without resetting after a deck change", async () => {
    const user = userEvent.setup();
    const mounted = render(DeckWorkspace, {
      deck: deckFixture(0),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
    });
    const toggle = mounted.container.querySelector(
      '[data-cy="deck-zone-toggle-side"]',
    )!;
    await user.click(toggle);
    expect(
      mounted.container.querySelector("#deck-zone-body-side"),
    ).not.toBeNull();

    await mounted.rerender({ deck: deckFixture(1) });
    expect(
      mounted.container.querySelector("#deck-zone-body-side"),
    ).not.toBeNull();

    await user.click(toggle);
    expect(mounted.container.querySelector("#deck-zone-body-side")).toBeNull();
  });

  it("the zone count sits inside the collapse control", () => {
    const { container } = render(DeckZoneGrid, {
      zone: "extra",
      label: "Extra Deck",
      codes: [],
      plan: FIFTEEN_CARD_GRID,
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
      totalCopies: new Map(),
    });
    const countEl = container.querySelector(
      '[data-cy="deck-zone-count-extra"]',
    );
    expect(countEl).not.toBeNull();
    expect(
      countEl!.closest('[data-cy="deck-zone-toggle-extra"]'),
    ).not.toBeNull();
  });

  it("clicking the header bar collapses the zone", async () => {
    const user = userEvent.setup();
    const ontogglecollapse = vi.fn();
    const { container } = render(DeckZoneGrid, {
      zone: "side",
      label: "Side Deck",
      codes: [],
      plan: FIFTEEN_CARD_GRID,
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
      totalCopies: new Map(),
      collapsed: false,
      ontogglecollapse,
    });
    const toggle = container.querySelector('[data-cy="deck-zone-toggle-side"]');
    expect(toggle!.getAttribute("aria-expanded")).toBe("true");
    await user.click(toggle!);
    expect(ontogglecollapse).toHaveBeenCalledOnce();
  });

  it("the main count reads 41/40-60 above forty cards", () => {
    const codes = Array.from({ length: 41 }, () => 89631139);
    const { container } = render(DeckZoneGrid, {
      zone: "main",
      label: "Main Deck",
      codes,
      plan: mainDeckGridPlan(codes.length),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
      totalCopies: new Map([[89631139, 41]]),
    });
    expect(
      container.querySelector('[data-cy="deck-zone-count-main"]')?.textContent,
    ).toBe("41/40-60");
  });

  it("zones stack full width with extra above side", () => {
    const { container } = render(DeckWorkspace, {
      deck: deckFixture(0),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
    });
    expect(
      container.querySelector('[data-cy="deck-workspace-secondary-zones"]'),
    ).toBeNull();
    const ordered = [
      ...container.querySelectorAll(
        '[data-cy="deck-zone-main"], [data-cy="deck-zone-extra"], [data-cy="deck-zone-side"]',
      ),
    ].map((el) => el.getAttribute("data-cy"));
    expect(ordered).toEqual([
      "deck-zone-main",
      "deck-zone-extra",
      "deck-zone-side",
    ]);
  });
});
