// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckSelectScreen from "../../../src/deck-select/DeckSelectScreen.svelte";
import { tile } from "./tile-builder.ts";

afterEach(() => cleanup());

function find(value: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
}

function cy(value: string): HTMLElement {
  const element = find(value);
  if (element === null) throw new Error(`No element with data-cy "${value}"`);
  return element;
}

function button(value: string): HTMLButtonElement {
  return cy(value) as HTMLButtonElement;
}

/** The tiles the grid shows, in the order it shows them. */
function gridOrder(): readonly string[] {
  return [...cy("deck-select-grid").children].map(
    (child) => child.getAttribute("data-cy") ?? "",
  );
}

function handlers() {
  return {
    onselect: vi.fn(),
    onstart: vi.fn(),
    onback: vi.fn(),
    onopen: vi.fn(),
    onrename: vi.fn(),
    onduplicate: vi.fn(),
    ondelete: vi.fn(),
    onfavourite: vi.fn(),
  };
}

/* Three decks the whole suite reuses: k1 and k3 legal, k2 not, and the illegal
   one carries the newest stamp so the ordering it lands in can only come from
   the rank function rather than from the sort. */
function decks() {
  return [
    tile({
      key: "k1",
      name: "Aurora Fleet",
      updatedAt: "2026-08-20T10:00:00.000Z",
    }),
    tile({
      key: "k2",
      name: "Blaze Circuit",
      legal: false,
      blockReason: "Main Deck needs 5 more card(s).",
      updatedAt: "2026-08-21T10:00:00.000Z",
    }),
    tile({
      key: "k3",
      name: "Cracked Relic",
      updatedAt: "2026-08-19T10:00:00.000Z",
    }),
  ];
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    mode: "duel-start" as const,
    eyebrow: "Free play",
    title: "Choose your deck",
    tiles: decks(),
    selectedKey: null,
    ...handlers(),
    ...overrides,
  };
}

describe("DeckSelectScreen", () => {
  it("orders and filters tiles with live count", async () => {
    render(DeckSelectScreen, props());

    expect(cy("deck-select-eyebrow").textContent).toBe("Free play");
    expect(cy("deck-select-title").textContent).toBe("Choose your deck");
    expect(gridOrder()).toEqual([
      "deck-tile-k1",
      "deck-tile-k3",
      "deck-tile-k2",
    ]);
    expect(cy("deck-select-count").textContent).toBe("3/3");

    await userEvent.setup().type(cy("deck-select-filter"), "aurora");

    expect(gridOrder()).toEqual(["deck-tile-k1"]);
    expect(cy("deck-select-count").textContent).toBe("1/3");
  });

  it("press selects, dblclick opens", async () => {
    const values = handlers();
    render(DeckSelectScreen, props(values));
    const user = userEvent.setup();

    await user.click(cy("deck-tile-press-k3"));
    expect(values.onselect).toHaveBeenCalledWith("k3");
    expect(values.onopen).not.toHaveBeenCalled();

    await user.dblClick(cy("deck-tile-press-k3"));
    expect(values.onopen).toHaveBeenCalledWith("k3");
  });

  it("kebab flow reaches rename with new name", async () => {
    const values = handlers();
    render(DeckSelectScreen, props(values));
    const user = userEvent.setup();

    await user.click(cy("deck-tile-menu-k1"));
    await user.click(cy("deck-tile-menu-rename-k1"));

    const field = cy("deck-select-rename-input");
    await user.clear(field);
    await user.type(field, "Renamed");
    await user.click(cy("deck-select-rename-submit"));

    expect(values.onrename).toHaveBeenCalledWith("k1", "Renamed");
    expect(find("deck-select-rename-dialog")).toBeNull();
  });

  it("kebab delete goes through confirm", async () => {
    const values = handlers();
    render(DeckSelectScreen, props(values));
    const user = userEvent.setup();

    await user.click(cy("deck-tile-menu-k1"));
    await user.click(cy("deck-tile-menu-delete-k1"));
    expect(values.ondelete).not.toHaveBeenCalled();

    await user.click(cy("deck-select-delete-confirm-button"));

    expect(values.ondelete).toHaveBeenCalledWith("k1");
    expect(find("deck-select-delete-confirm")).toBeNull();
  });

  it("footer management disabled without selection", () => {
    render(DeckSelectScreen, props({ selectedKey: null }));

    expect(button("deck-select-delete").disabled).toBe(true);
    expect(button("deck-select-rename").disabled).toBe(true);
    expect(button("deck-select-duplicate").disabled).toBe(true);
  });

  it("footer delete disabled for undeletable pick", () => {
    render(
      DeckSelectScreen,
      props({
        tiles: [tile({ key: "b1", bundled: true, deletable: false })],
        selectedKey: "b1",
      }),
    );

    expect(button("deck-select-delete").disabled).toBe(true);
    expect(button("deck-select-rename").disabled).toBe(false);
    expect(button("deck-select-duplicate").disabled).toBe(false);
  });

  /* The story commits to an encounter on this screen, so it renders no way
     back at all — and the two controls go together, because they are one
     affordance the layout shows at two widths. */
  it("showBack=false hides both back controls", async () => {
    const base = props();
    const { rerender } = render(DeckSelectScreen, base);

    expect(find("deck-select-back")).not.toBeNull();
    expect(find("deck-select-back-icon")).not.toBeNull();

    await rerender({ ...base, showBack: false });

    expect(find("deck-select-back")).toBeNull();
    expect(find("deck-select-back-icon")).toBeNull();
  });

  /* A scope whose decks are managed somewhere else renders none of the
     management affordances: the footer cluster and every tile's kebab go with
     it, while Open and Start — the ways off this screen — stay. */
  it("manageable=false hides the manage cluster and the kebabs", () => {
    render(DeckSelectScreen, props({ selectedKey: "k1", manageable: false }));

    expect(find("deck-select-manage")).toBeNull();
    expect(find("deck-select-delete")).toBeNull();
    expect(find("deck-select-rename")).toBeNull();
    expect(find("deck-select-duplicate")).toBeNull();
    for (const key of ["k1", "k2", "k3"])
      expect(find(`deck-tile-menu-${key}`)).toBeNull();
    /* The picking half of the screen is untouched: this hides operations on a
       deck, not the deck itself. */
    expect(find("deck-tile-press-k1")).not.toBeNull();
    expect(find("deck-select-open")).not.toBeNull();
    expect(find("deck-select-start")).not.toBeNull();
  });

  it("library mode hides Open and Start", () => {
    render(
      DeckSelectScreen,
      props({ mode: "library", title: "Deck library", selectedKey: "k1" }),
    );

    expect(find("deck-select-open")).toBeNull();
    expect(find("deck-select-start")).toBeNull();
    expect(find("deck-select-back")).not.toBeNull();
    expect(find("deck-select-rename")).not.toBeNull();
  });

  it("start disabled until canStart", async () => {
    const values = handlers();
    const base = props({ ...values, selectedKey: "k1", canStart: false });
    const { rerender } = render(DeckSelectScreen, base);

    expect(button("deck-select-start").disabled).toBe(true);
    expect(button("deck-select-start").textContent).toBe("Start the duel");

    await rerender({ ...base, canStart: true });
    expect(button("deck-select-start").disabled).toBe(false);

    await userEvent.setup().click(cy("deck-select-start"));
    expect(values.onstart).toHaveBeenCalledTimes(1);
  });

  it("slash focuses filter", async () => {
    render(DeckSelectScreen, props());

    await fireEvent.keyDown(window, { key: "/" });

    expect(document.activeElement).toBe(cy("deck-select-filter"));
  });

  it("arrows skip illegal decks", async () => {
    const values = handlers();
    render(DeckSelectScreen, props({ ...values, selectedKey: "k1" }));

    await fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(values.onselect).toHaveBeenCalledWith("k3");

    /* k1 is the first legal deck, so there is nowhere above it to go: the pick
       stays put rather than wrapping onto the illegal tail. */
    await fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(values.onselect).toHaveBeenCalledTimes(1);
  });

  it("f toggles favourite of selection", async () => {
    const values = handlers();
    render(DeckSelectScreen, props({ ...values, selectedKey: "k1" }));

    await fireEvent.keyDown(window, { key: "f" });

    expect(values.onfavourite).toHaveBeenCalledWith("k1", true);
  });

  it("opponent seat mode paints grid red and badges yours", () => {
    const pool = decks();
    render(
      DeckSelectScreen,
      props({
        selectedKey: "k1",
        seat: "opponent",
        opponent: {
          id: "vault-warden",
          name: "Vault Warden",
          line: "Locks the board, then closes it out.",
          locked: false,
        },
        opponentDeck: pool[1],
        playerDeck: pool[0],
      }),
    );

    /* Your own deck is on its seat card as well as in the grid, so each
       assertion asks the grid for its copy. */
    const grid = cy("deck-select-grid");
    const theirs = grid.querySelector('[data-cy="deck-tile-k2"]');
    expect(theirs?.classList).toContain("halo-opponent");
    expect(grid.querySelector('[data-cy="deck-tile-check-k2"]')).not.toBeNull();

    const yours = grid.querySelector('[data-cy="deck-tile-k1"]');
    expect(yours?.classList).not.toContain("halo-you");
    expect(
      grid.querySelector('[data-cy="deck-tile-badge-yours-k1"]'),
    ).not.toBeNull();
  });

  it("block notice renders", () => {
    render(DeckSelectScreen, props({ blockNotice: "No decks yet" }));

    const notice = cy("deck-select-block-notice");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toBe("No decks yet");
  });
});
