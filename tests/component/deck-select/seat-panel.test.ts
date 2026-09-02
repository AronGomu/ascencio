// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
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

/* Your own deck is normally in the grid as well as on its seat card, so the
   card's copy carries its own `cyKey`; asking the card rather than the document
   is what proves the renamed tile is the one inside it. */
function inside(container: HTMLElement, value: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-cy="${value}"]`);
  if (element === null)
    throw new Error(`No element with data-cy "${value}" inside the card`);
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
    ...handlers(),
    ...overrides,
  };
}

describe("DeckSelectScreen seat panel", () => {
  it("panel renders opponent identity and both seat cards", () => {
    render(DeckSelectScreen, props());

    expect(find("duel-start-seat-panel")).not.toBeNull();
    expect(cy("duel-start-opponent-name").textContent).toBe("Vault Warden");
    expect(cy("duel-start-opponent-line").textContent).toBe(
      "Locks the board, then closes it out.",
    );
    const portrait = cy("duel-start-opponent-portrait");
    expect(portrait.tagName).toBe("BUTTON");
    expect(portrait.getAttribute("aria-label")).toBe(
      "Change opponent: Vault Warden",
    );
    expect(find("duel-start-opponent-change-chip")).not.toBeNull();

    const theirs = cy("duel-start-opponent-deck");
    expect(theirs.getAttribute("aria-pressed")).toBe("false");
    expect(inside(theirs, "deck-tile-opponent-o1").classList).toContain(
      "halo-opponent",
    );
    expect(inside(theirs, "deck-tile-name-opponent-o1").textContent).toBe(
      "Warden Vault",
    );

    const yours = cy("duel-start-your-deck");
    expect(yours.getAttribute("aria-pressed")).toBe("true");
    expect(inside(yours, "deck-tile-yours-k1").classList).toContain(
      "halo-focus",
    );
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
    const lockedTile = inside(deck, "deck-tile-opponent-o1");
    expect(lockedTile.classList).toContain("halo-opponent");
    expect(lockedTile.classList).not.toContain("halo-focus");
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
    expect(inside(theirs, "deck-tile-opponent-o1").classList).toContain(
      "halo-focus",
    );
    expect(inside(yours, "deck-tile-yours-k1").classList).toContain("halo-you");

    await user.click(theirs);
    expect(values.onseat).toHaveBeenLastCalledWith("player");
  });

  it("your deck card returns to player seat", async () => {
    const values = handlers();
    render(DeckSelectScreen, props({ ...values, seat: "opponent" }));

    await userEvent.setup().click(cy("duel-start-your-deck"));

    expect(values.onseat).toHaveBeenCalledWith("player");
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
