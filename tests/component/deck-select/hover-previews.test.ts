// @vitest-environment jsdom

import { readFileSync } from "fs";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckSelectScreen from "../../../src/deck-select/DeckSelectScreen.svelte";
import type { DecklistView } from "../../../src/deck-select/deck-select-contracts.ts";
import { tile } from "./tile-builder.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function find(value: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
}

function cy(value: string): HTMLElement {
  const element = find(value);
  if (element === null) throw new Error(`No element with data-cy "${value}"`);
  return element;
}

const AURORA: DecklistView = {
  main: [
    {
      code: 101,
      name: "Aurora Scout",
      frame: "spell",
      artUrl: "blob:x",
    },
    {
      code: 102,
      name: "Aurora Sentinel",
      frame: "normal",
      artUrl: null,
    },
  ],
  extra: [
    {
      code: 201,
      name: "Aurora Colossus",
      frame: "link",
      artUrl: "blob:extra",
    },
  ],
  side: [],
};

const RELIC: DecklistView = {
  main: [
    {
      code: 301,
      name: "Relic Keeper",
      frame: "effect",
      artUrl: null,
    },
  ],
  extra: [],
  side: [],
};

const WARDEN: DecklistView = {
  main: [
    {
      code: 401,
      name: "Warden Guard",
      frame: "effect",
      artUrl: null,
    },
  ],
  extra: [],
  side: [],
};

const LISTS: Readonly<Record<string, DecklistView>> = {
  k1: AURORA,
  k3: RELIC,
  o1: WARDEN,
};

function resolver() {
  return vi.fn(async (key: string) => LISTS[key] ?? null);
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
    opponent: {
      id: "vault-warden",
      name: "Vault Warden",
      line: "Locks the board, then closes it out.",
      locked: false,
    },
    opponentDeck: tile({ key: "o1", name: "Warden Vault", bundled: true }),
    playerDeck: tile({ key: "k1", name: "Aurora Fleet" }),
    decklistFor: resolver(),
    ...overrides,
  };
}

describe("DeckSelectScreen hover previews", () => {
  it("duel-start hover docks the decklist into the active player seat", async () => {
    const decklistFor = resolver();
    render(DeckSelectScreen, props({ decklistFor }));

    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-101")).not.toBeNull(),
    );
    await fireEvent.pointerEnter(cy("deck-tile-k3"));

    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-301")).not.toBeNull(),
    );
    expect(decklistFor).toHaveBeenCalledWith("k3");
    expect(cy("deck-select-seat-list-player-wrapper").classList).toContain(
      "previewing",
    );
    expect(cy("deck-select-seat-list-player-main-heading").textContent).toBe(
      "Main (1)",
    );
    expect(find("deck-select-seat-list-opponent-row-401")).not.toBeNull();
    expect(find("deck-select-hover-float")).toBeNull();
  });

  it("pointer leave restores the player's picked decklist", async () => {
    render(DeckSelectScreen, props());

    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-101")).not.toBeNull(),
    );
    await fireEvent.pointerEnter(cy("deck-tile-k3"));
    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-301")).not.toBeNull(),
    );

    await fireEvent.pointerLeave(cy("deck-tile-k3"));

    expect(find("deck-select-seat-list-player-row-101")).not.toBeNull();
    expect(find("deck-select-seat-list-player-row-301")).toBeNull();
    expect(cy("deck-select-seat-list-player-wrapper").classList).not.toContain(
      "previewing",
    );
    expect(find("deck-select-hover-float")).toBeNull();
  });

  it("stale resolution never renders", async () => {
    let settleSlow: (list: DecklistView | null) => void = () => undefined;
    const decklistFor = vi.fn((key: string) =>
      key === "k1"
        ? new Promise<DecklistView | null>((resolve) => (settleSlow = resolve))
        : Promise.resolve(LISTS[key] ?? null),
    );
    render(
      DeckSelectScreen,
      props({ decklistFor, selectedKey: null, playerDeck: null }),
    );

    await fireEvent.pointerEnter(cy("deck-tile-k1"));
    await fireEvent.pointerEnter(cy("deck-tile-k3"));
    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-301")).not.toBeNull(),
    );

    /* The deck the pointer already left answers last; it is answering a
       question nobody is asking any more. */
    settleSlow(AURORA);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(find("deck-select-seat-list-player-row-301")).not.toBeNull();
    expect(find("deck-select-seat-list-player-row-101")).toBeNull();
  });

  it("stale resting seat resolutions never replace newer picks", async () => {
    let settlePlayer: (list: DecklistView | null) => void = () => undefined;
    let settleOpponent: (list: DecklistView | null) => void = () => undefined;
    const decklistFor = vi.fn((key: string) => {
      if (key === "k1")
        return new Promise<DecklistView | null>(
          (resolve) => (settlePlayer = resolve),
        );
      if (key === "o1")
        return new Promise<DecklistView | null>(
          (resolve) => (settleOpponent = resolve),
        );
      return Promise.resolve(key === "k3" ? RELIC : WARDEN);
    });
    const base = props({ decklistFor });
    const { rerender } = render(DeckSelectScreen, base);
    await waitFor(() => {
      expect(decklistFor).toHaveBeenCalledWith("k1");
      expect(decklistFor).toHaveBeenCalledWith("o1");
    });

    await rerender({
      ...base,
      selectedKey: "k3",
      playerDeck: tile({ key: "k3", name: "Cracked Relic" }),
      opponentDeck: tile({ key: "o2", name: "Second Warden" }),
    });
    await waitFor(() => {
      expect(find("deck-select-seat-list-player-row-301")).not.toBeNull();
      expect(find("deck-select-seat-list-opponent-row-401")).not.toBeNull();
    });

    settlePlayer(AURORA);
    settleOpponent(AURORA);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(find("deck-select-seat-list-player-row-301")).not.toBeNull();
    expect(find("deck-select-seat-list-opponent-row-401")).not.toBeNull();
    expect(find("deck-select-seat-list-player-row-101")).toBeNull();
    expect(find("deck-select-seat-list-opponent-row-101")).toBeNull();
  });

  it("copies of one card share a row", async () => {
    const trio: DecklistView = {
      main: [
        {
          code: 101,
          name: "Aurora Scout",
          frame: "spell",
          artUrl: "blob:x",
        },
        {
          code: 101,
          name: "Aurora Scout",
          frame: "effect",
          artUrl: null,
        },
        {
          code: 101,
          name: "Aurora Scout",
          frame: "normal",
          artUrl: null,
        },
      ],
      extra: [],
      side: [],
    };
    render(
      DeckSelectScreen,
      props({ decklistFor: async () => trio, selectedKey: "k1" }),
    );

    await fireEvent.pointerEnter(cy("deck-tile-k1"));
    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-101")).not.toBeNull(),
    );

    /* Three copies, one row: the heading carries the count and the row carries
       the copies, so the row's `data-cy` stays unique in the document. */
    expect(
      document.querySelectorAll(
        '[data-cy="deck-select-seat-list-player-row-101"]',
      ),
    ).toHaveLength(1);
    expect(cy("deck-select-seat-list-player-main-heading").textContent).toBe(
      "Main (3)",
    );
    const trioCopies = cy("deck-select-seat-list-player-row-copies-101");
    expect(trioCopies.textContent).toBe("3");
    expect(trioCopies.classList.contains("single")).toBe(false);
    expect(
      cy("deck-select-seat-list-player-row-101").style.getPropertyValue("--fc"),
    ).toBe("#1d9e74");
    expect(find("deck-select-seat-list-player-row-art-101")).not.toBeNull();
  });

  it("opponent seat receives hover preview while player list stays put", async () => {
    render(DeckSelectScreen, props({ seat: "opponent" }));

    await waitFor(() => {
      expect(find("deck-select-seat-list-player-row-101")).not.toBeNull();
      expect(find("deck-select-seat-list-opponent-row-401")).not.toBeNull();
    });

    await fireEvent.pointerEnter(cy("deck-tile-k3"));

    await waitFor(() =>
      expect(find("deck-select-seat-list-opponent-row-301")).not.toBeNull(),
    );
    expect(find("deck-select-seat-list-opponent-row-401")).toBeNull();
    expect(find("deck-select-seat-list-player-row-101")).not.toBeNull();
    expect(cy("deck-select-seat-list-opponent-wrapper").classList).toContain(
      "previewing",
    );
    expect(cy("deck-select-seat-list-player-wrapper").classList).not.toContain(
      "previewing",
    );
  });

  it("null seat list renders an explicit empty state", async () => {
    const base = props();
    const { rerender } = render(DeckSelectScreen, base);
    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-101")).not.toBeNull(),
    );

    await rerender({ ...base, decklistFor: async () => null });

    await waitFor(() => {
      expect(find("deck-select-seat-list-player-row-101")).toBeNull();
      expect(find("deck-select-seat-list-empty-player")).not.toBeNull();
      expect(find("deck-select-seat-list-empty-opponent")).not.toBeNull();
    });
    expect(cy("deck-select-seat-list-empty-player").textContent).toBe(
      "No list available.",
    );
  });

  it("library hover previews in dock without moving selection", async () => {
    const onselect = vi.fn();
    render(
      DeckSelectScreen,
      props({ mode: "library", title: "Deck library", onselect }),
    );

    await waitFor(() =>
      expect(find("deck-select-docked-list-row-101")).not.toBeNull(),
    );
    /* The dock is the same panel: a single copy counts there too. */
    expect(cy("deck-select-docked-list-row-copies-101").textContent).toBe("1");

    await fireEvent.pointerEnter(cy("deck-tile-k3"));
    await waitFor(() =>
      expect(find("deck-select-docked-list-row-301")).not.toBeNull(),
    );
    expect(find("deck-select-docked-list-row-101")).toBeNull();
    expect(onselect).not.toHaveBeenCalled();
    /* The library previews in its column; nothing floats beside the tile. */
    expect(find("deck-select-hover-float")).toBeNull();

    await fireEvent.pointerLeave(cy("deck-tile-k3"));

    await waitFor(() =>
      expect(find("deck-select-docked-list-row-101")).not.toBeNull(),
    );
    expect(find("deck-select-docked-list-row-301")).toBeNull();
  });

  it("dock empty state without selection", () => {
    render(DeckSelectScreen, props({ mode: "library", selectedKey: null }));

    expect(find("deck-select-docked-empty")).not.toBeNull();
    expect(find("deck-select-docked-list")).toBeNull();
  });

  it("card art floats over dock row", async () => {
    const cardImageFor = vi.fn((code: number) =>
      code === 101 ? "/runtime/images/101.jpg" : null,
    );
    render(DeckSelectScreen, props({ mode: "library", cardImageFor }));
    await waitFor(() =>
      expect(find("deck-select-docked-list-row-101")).not.toBeNull(),
    );

    await fireEvent.pointerEnter(cy("deck-select-docked-list-row-101"));

    expect(cy("deck-select-card-art-float").getAttribute("src")).toBe(
      "/runtime/images/101.jpg",
    );

    await fireEvent.pointerLeave(cy("deck-select-docked-list-row-101"));
    expect(find("deck-select-card-art-float")).toBeNull();

    /* A card this build packages no art for floats nothing at all. */
    await fireEvent.pointerEnter(cy("deck-select-docked-list-row-102"));
    expect(find("deck-select-card-art-float")).toBeNull();
  });

  it("remaining display classes keep hidden guards", () => {
    render(DeckSelectScreen, props({ mode: "library", title: "Deck library" }));

    /* `vite-plugin-svelte` keeps component CSS out of the jsdom document, so
       guards are read by selector like
       `tests/component/deck-editor/card-tile-art.test.ts`. */
    guarded(SCREEN_SOURCE, ".dock");
    guarded(SCREEN_SOURCE, ".art-float");
    guarded(PANEL_SOURCE, ".decklist");
    expect(SCREEN_SOURCE).not.toContain('data-cy="deck-select-hover-float"');
  });

  it("coarse pointers do not preview grid tiles", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const decklistFor = resolver();
    render(DeckSelectScreen, props({ decklistFor }));
    await waitFor(() =>
      expect(find("deck-select-seat-list-player-row-101")).not.toBeNull(),
    );

    await fireEvent.pointerEnter(cy("deck-tile-k3"));

    expect(find("deck-select-seat-list-player-row-301")).toBeNull();
    expect(decklistFor).not.toHaveBeenCalledWith("k3");
  });

  it("no hover preview when narrow", async () => {
    const decklistFor = resolver();
    render(DeckSelectScreen, props({ decklistFor, forceNarrow: true }));
    await waitFor(() => expect(decklistFor).toHaveBeenCalledWith("k1"));

    await fireEvent.pointerEnter(cy("deck-tile-k3"));

    expect(find("deck-select-seat-list-player-row-301")).toBeNull();
    expect(decklistFor).not.toHaveBeenCalledWith("k3");
    expect(find("deck-select-hover-float")).toBeNull();
  });
});

const SCREEN_SOURCE = readFileSync(
  "src/deck-select/DeckSelectScreen.svelte",
  "utf8",
);
const PANEL_SOURCE = readFileSync(
  "src/deck-select/DecklistPanel.svelte",
  "utf8",
);

function rules(source: string): ReadonlyMap<string, string> {
  /* Comments go first: a rule that carries one would otherwise be keyed by its
     own explanation, since everything since the previous `}` is the selector
     as far as this reads it. */
  const style = (/<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const found = new Map<string, string>();
  for (const [, selector, body] of style.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    found.set(
      (selector ?? "").trim().replace(/\s+/g, " "),
      (body ?? "").trim(),
    );
  return found;
}

/** Every class that declares a `display` of its own has to answer `[hidden]`
    itself, because an author rule on a class beats the user agent's. */
function guarded(source: string, selector: string): void {
  const guard = `${selector}:global([hidden])`;
  const body = rules(source).get(guard);
  expect(body, `no \`${guard}\` rule`).toBeDefined();
  expect(body).toContain("display: none");
}
