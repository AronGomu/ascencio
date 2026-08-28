// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckSelectScreen from "../../../src/deck-select/DeckSelectScreen.svelte";
import type { OpponentView } from "../../../src/deck-select/deck-select-contracts.ts";
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

/** The tiles the grid shows, in the order it shows them. */
function gridOrder(): readonly string[] {
  return [...cy("deck-select-grid").children].map(
    (child) => child.getAttribute("data-cy") ?? "",
  );
}

const OPPONENT: OpponentView = {
  id: "vault-warden",
  name: "Vault Warden",
  line: "Locks the board, then closes it out.",
  locked: false,
};

/* k1 is the scope's default, so the rank function puts it first and any other
   deck reaching slot 1 can only have been pinned there. */
function decks() {
  return [
    tile({
      key: "k1",
      name: "Aurora Fleet",
      isDefault: true,
      updatedAt: "2026-08-20T10:00:00.000Z",
    }),
    tile({
      key: "k2",
      name: "Blaze Circuit",
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
    selectedKey: "k3",
    forceNarrow: true,
    ...overrides,
  };
}

describe("DeckSelectScreen mobile layout", () => {
  it("narrow pins the player seat's pick to the first slot", () => {
    render(DeckSelectScreen, props());

    expect(gridOrder()).toEqual([
      "deck-tile-k3",
      "deck-tile-k1",
      "deck-tile-k2",
    ]);
  });

  it("narrow pins the opponent's pick while their seat is being filled", () => {
    const pool = decks();
    render(
      DeckSelectScreen,
      props({
        seat: "opponent",
        opponent: OPPONENT,
        opponentDeck: pool[1],
        playerDeck: pool[2],
        tiles: pool,
      }),
    );

    expect(gridOrder()).toEqual([
      "deck-tile-k2",
      "deck-tile-k1",
      "deck-tile-k3",
    ]);
  });

  it("wide keeps the rank order", () => {
    render(DeckSelectScreen, props({ forceNarrow: false }));

    expect(gridOrder()).toEqual([
      "deck-tile-k1",
      "deck-tile-k2",
      "deck-tile-k3",
    ]);
  });

  it("narrow header carries a back icon that fires onback", async () => {
    const onback = vi.fn();
    render(DeckSelectScreen, props({ onback }));

    const icon = cy("deck-select-back-icon");
    expect(cy("deck-select-header").contains(icon)).toBe(true);
    expect(icon.getAttribute("aria-label")).toBe("Back");

    await userEvent.setup().click(icon);
    expect(onback).toHaveBeenCalledTimes(1);
  });

  it("both back controls render exactly once whatever the width", async () => {
    /* Neither is conditional: the icon is the narrow control and the footer
       button the wide one, and CSS hides whichever the width does not use, so
       the element contract still sees one of each. */
    const base = props({ forceNarrow: false });
    const { rerender } = render(DeckSelectScreen, base);

    for (const value of ["deck-select-back-icon", "deck-select-back"]) {
      expect(document.querySelectorAll(`[data-cy="${value}"]`)).toHaveLength(1);
    }

    await rerender({ ...base, forceNarrow: true });
    for (const value of ["deck-select-back-icon", "deck-select-back"]) {
      expect(document.querySelectorAll(`[data-cy="${value}"]`)).toHaveLength(1);
    }
  });
});
