// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckSelectScreen from "../../../src/deck-select/DeckSelectScreen.svelte";
import type {
  DecklistView,
  OpponentView,
} from "../../../src/deck-select/deck-select-contracts.ts";
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

/** The three free-play personas, in the shape the screen renders them. */
const OPPONENTS: readonly OpponentView[] = [
  {
    id: "practice-bot",
    name: "Practice Bot",
    line: "No narrative, no save. Pick both decks and duel now.",
    locked: false,
  },
  {
    id: "blaze-circuit",
    name: "Blaze Circuit",
    line: "Plays fast and punishes hesitation.",
    locked: false,
  },
  {
    id: "vault-warden",
    name: "Vault Warden",
    line: "Locks the board, then closes it out.",
    locked: false,
  },
];

const STORY_OPPONENT: OpponentView = {
  id: "arena-transmitter",
  name: "Arena Transmitter",
  line: "Finish the duel to decode its challenge.",
  locked: true,
};

const PLAYER_LIST: DecklistView = {
  main: [{ code: 101, name: "Aurora Scout", frame: "spell", artUrl: null }],
  extra: [],
  side: [],
};

const OPPONENT_LIST: DecklistView = {
  main: [{ code: 201, name: "Vault Guard", frame: "effect", artUrl: null }],
  extra: [],
  side: [],
};

function handlers() {
  return {
    onselect: vi.fn(),
    onstart: vi.fn(),
    onseat: vi.fn(),
    onpickopponent: vi.fn(),
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    mode: "duel-start" as const,
    eyebrow: "Free play",
    title: "Choose your deck",
    tiles: [
      tile({ key: "k1", name: "Aurora Fleet" }),
      tile({ key: "k3", name: "Cracked Relic" }),
    ],
    selectedKey: "k1",
    opponent: OPPONENTS[2]!,
    opponents: OPPONENTS,
    opponentDeck: tile({ key: "o1", name: "Warden Vault", bundled: true }),
    playerDeck: tile({ key: "k1", name: "Aurora Fleet" }),
    decklistFor: vi.fn(async (key: string) =>
      key === "k1" ? PLAYER_LIST : key === "o1" ? OPPONENT_LIST : null,
    ),
    ...handlers(),
    ...overrides,
  };
}

describe("DeckSelectScreen seat panel", () => {
  it("renders player-left and opponent-right seat sections with docked lists", async () => {
    render(DeckSelectScreen, props());

    const panel = cy("duel-start-seat-panel");
    const seats = cy("deck-select-seats");
    expect(
      [...seats.children].map((child) => child.getAttribute("data-cy")),
    ).toEqual(["seat-section-player", "seat-section-opponent"]);
    expect(panel.firstElementChild).toBe(seats);
    expect(panel.lastElementChild).toBe(cy("deck-select-start"));

    expect(cy("duel-start-your-name").textContent).toBe("You");
    const yours = cy("duel-start-your-deck");
    expect(yours.getAttribute("aria-pressed")).toBe("true");
    expect(yours.textContent?.trim()).toBe("Aurora Fleet");
    expect(yours.textContent).not.toContain("Main");

    const portrait = cy("duel-start-opponent-portrait");
    expect(portrait.tagName).toBe("BUTTON");
    expect(portrait.getAttribute("aria-label")).toBe(
      "Change opponent: Vault Warden",
    );
    expect(cy("duel-start-opponent-name").textContent).toBe("Vault Warden");
    expect(find("duel-start-opponent-change-chip")).not.toBeNull();

    const theirs = cy("duel-start-opponent-deck");
    expect(theirs.getAttribute("aria-pressed")).toBe("false");
    expect(theirs.textContent?.trim()).toBe("Warden Vault");
    expect(theirs.textContent).not.toContain("Main");

    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-101")).not.toBeNull(),
    );
    expect(find("deck-select-seat-list-opponent-row-201")).not.toBeNull();
  });

  it("declares the approved twin-column pane and grid parameters", () => {
    const source = readFileSync(
      "src/deck-select/DeckSelectScreen.svelte",
      "utf8",
    );

    const seats = [...source.matchAll(/\.seats\s*\{([^}]*)\}/g)]
      .map((match) => match[1] ?? "")
      .find((body) => body.includes("gap: var(--space-3)"));
    expect(seats).toContain("grid-template-columns: 1fr 1fr");

    const pane = /\.screen\.paneled:not\(\.library\)\s*\{([^}]*)\}/.exec(
      source,
    )?.[1];
    expect(pane).toContain("grid-template-columns: minmax(0, 73fr) 38rem");

    const seatPanel = [...source.matchAll(/\.seat-panel\s*\{([^}]*)\}/g)]
      .map((match) => match[1] ?? "")
      .find((body) => body.includes("grid-template-rows"));
    expect(seatPanel).toContain(
      "grid-template-rows: minmax(0, 1fr) max-content",
    );
    expect(seatPanel).toContain("background: var(--glass)");

    const grid = /\.grid\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
    expect(grid).toContain("repeat(auto-fit, minmax(min(100%, 12rem), 1fr))");
    expect(grid).toContain("gap: var(--space-2)");
    expect(grid).toContain("scrollbar-gutter: stable");
    expect(grid).toContain("padding-right: var(--space-2)");
  });

  it("panel absent in library mode", async () => {
    const { rerender } = render(
      DeckSelectScreen,
      props({ mode: "library", title: "Deck library" }),
    );

    expect(find("duel-start-seat-panel")).toBeNull();

    /* The other half of the same rule: duel start with no opponent to seat
       renders no panel either. */
    await rerender(props({ opponent: null }));
    expect(find("duel-start-seat-panel")).toBeNull();
  });

  it("portrait opens picker, choice reported", async () => {
    const values = handlers();
    render(DeckSelectScreen, props(values));
    const user = userEvent.setup();

    await user.click(cy("duel-start-opponent-portrait"));

    const picker = cy("duel-start-opponent-picker");
    expect(picker.getAttribute("role")).toBe("dialog");
    expect(picker.getAttribute("aria-modal")).toBe("true");
    expect(
      cy("duel-start-opponent-option-vault-warden").getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");

    await user.click(cy("duel-start-opponent-option-blaze-circuit"));

    expect(values.onpickopponent).toHaveBeenCalledWith("blaze-circuit");
    expect(find("duel-start-opponent-picker")).toBeNull();
  });

  it("locked opponent has no controls", async () => {
    render(
      DeckSelectScreen,
      props({ opponent: STORY_OPPONENT, opponents: [], seat: "opponent" }),
    );

    const portrait = cy("duel-start-opponent-portrait");
    expect(portrait.tagName).toBe("DIV");
    expect(find("duel-start-opponent-change-chip")).toBeNull();

    await userEvent.setup().click(portrait);
    expect(find("duel-start-opponent-picker")).toBeNull();

    const deck = cy("duel-start-opponent-deck");
    expect(deck.tagName).toBe("DIV");
    expect(deck.textContent?.trim()).toBe("Warden Vault");
    expect(deck.classList).not.toContain("active");
    expect(cy("duel-start-opponent-deck-locked").textContent).toBe(
      "🔒 Set by the story",
    );
  });

  it("opponent deck card toggles seat and moves the orange update halo", async () => {
    const values = handlers();
    const base = props({ ...values, seat: "player" });
    const { rerender } = render(DeckSelectScreen, base);
    const user = userEvent.setup();

    await user.click(cy("duel-start-opponent-deck"));
    expect(values.onseat).toHaveBeenCalledWith("opponent");

    /* The host owns the seat, so the screen only reports the press; the
       second press returns to picking for yourself once it has. */
    await rerender({ ...base, seat: "opponent" });
    const theirs = cy("duel-start-opponent-deck");
    const yours = cy("duel-start-your-deck");
    expect(theirs.getAttribute("aria-pressed")).toBe("true");
    expect(yours.getAttribute("aria-pressed")).toBe("false");
    expect(theirs.classList).toContain("active");
    expect(yours.classList).not.toContain("active");

    await user.click(theirs);
    expect(values.onseat).toHaveBeenLastCalledWith("player");
  });

  it("your deck chip returns to player seat and falls back to selected tile", async () => {
    const values = handlers();
    const base = props({
      ...values,
      seat: "opponent",
      playerDeck: null,
    });
    const { rerender } = render(DeckSelectScreen, base);

    expect(cy("duel-start-your-deck").textContent?.trim()).toBe("Aurora Fleet");
    await userEvent.setup().click(cy("duel-start-your-deck"));
    expect(values.onseat).toHaveBeenCalledWith("player");

    await rerender({ ...base, selectedKey: null });
    expect(find("duel-start-your-deck")).not.toBeNull();
    expect(cy("duel-start-your-deck-empty").textContent).toBe(
      "No deck selected",
    );
  });

  it("picker escape closes without pick", async () => {
    const values = handlers();
    render(DeckSelectScreen, props(values));

    await userEvent.setup().click(cy("duel-start-opponent-portrait"));
    expect(document.activeElement).toBe(
      cy("duel-start-opponent-option-practice-bot"),
    );

    await fireEvent.keyDown(cy("duel-start-opponent-picker"), {
      key: "Escape",
    });

    expect(find("duel-start-opponent-picker")).toBeNull();
    expect(values.onpickopponent).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(cy("duel-start-opponent-portrait"));
  });

  it("picker outside press closes without pick", async () => {
    const values = handlers();
    render(DeckSelectScreen, props(values));

    await userEvent.setup().click(cy("duel-start-opponent-portrait"));
    await fireEvent.pointerDown(cy("deck-select-grid"));

    expect(find("duel-start-opponent-picker")).toBeNull();
    expect(values.onpickopponent).not.toHaveBeenCalled();
  });
});
