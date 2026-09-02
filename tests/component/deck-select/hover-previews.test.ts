// @vitest-environment jsdom

import { readFileSync } from "fs";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckSelectScreen from "../../../src/deck-select/DeckSelectScreen.svelte";
import type { DecklistView } from "../../../src/deck-select/deck-select-contracts.ts";
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

const LISTS: Readonly<Record<string, DecklistView>> = { k1: AURORA, k3: RELIC };

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
    decklistFor: resolver(),
    ...overrides,
  };
}

describe("DeckSelectScreen hover previews", () => {
  it("duel-start hover floats the decklist", async () => {
    const decklistFor = resolver();
    render(DeckSelectScreen, props({ decklistFor }));

    await fireEvent.pointerEnter(cy("deck-tile-k1"));

    await waitFor(() => expect(find("deck-select-hover-list")).not.toBeNull());
    expect(decklistFor).toHaveBeenCalledWith("k1");
    expect(cy("deck-select-hover-list-main-heading").textContent).toBe(
      "Main (2)",
    );
    expect(cy("deck-select-hover-list-extra-heading").textContent).toBe(
      "Extra (1)",
    );
    expect(cy("deck-select-hover-list-side-heading").textContent).toBe(
      "Side (0)",
    );
    const artRow = cy("deck-select-hover-list-row-101");
    expect(artRow.textContent).toContain("Aurora Scout");
    expect(artRow.style.getPropertyValue("--fc")).toBe("#1d9e74");
    expect(artRow.style.getPropertyValue("--img")).toContain("blob:x");
    expect(find("deck-select-hover-list-row-art-101")).not.toBeNull();
    expect(find("deck-select-hover-list-row-fade-101")).not.toBeNull();

    const degradedRow = cy("deck-select-hover-list-row-102");
    expect(degradedRow.style.getPropertyValue("--fc")).toBe("#b8985a");
    expect(find("deck-select-hover-list-row-art-102")).toBeNull();
    expect(find("deck-select-hover-list-row-fade-102")).toBeNull();
    expect(cy("deck-select-hover-list-row-name-102").textContent).toBe(
      "Aurora Sentinel",
    );
    const singleCopies = cy("deck-select-hover-list-row-copies-102");
    expect(singleCopies.textContent).toBe("");
    expect(singleCopies.classList.contains("single")).toBe(true);
    expect(find("deck-select-hover-list-row-201")).not.toBeNull();
  });

  it("float leaves with the pointer", async () => {
    render(DeckSelectScreen, props());

    await fireEvent.pointerEnter(cy("deck-tile-k1"));
    await waitFor(() => expect(find("deck-select-hover-list")).not.toBeNull());

    await fireEvent.pointerLeave(cy("deck-tile-k1"));

    expect(find("deck-select-hover-list")).toBeNull();
    expect(find("deck-select-hover-float")).toBeNull();
  });

  it("stale resolution never renders", async () => {
    let settleSlow: (list: DecklistView | null) => void = () => undefined;
    const decklistFor = vi.fn((key: string) =>
      key === "k1"
        ? new Promise<DecklistView | null>((resolve) => (settleSlow = resolve))
        : Promise.resolve(LISTS[key] ?? null),
    );
    render(DeckSelectScreen, props({ decklistFor }));

    await fireEvent.pointerEnter(cy("deck-tile-k1"));
    await fireEvent.pointerEnter(cy("deck-tile-k3"));
    await waitFor(() =>
      expect(find("deck-select-hover-list-row-301")).not.toBeNull(),
    );

    /* The deck the pointer already left answers last; it is answering a
       question nobody is asking any more. */
    settleSlow(AURORA);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(find("deck-select-hover-list-row-301")).not.toBeNull();
    expect(find("deck-select-hover-list-row-101")).toBeNull();
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
      expect(find("deck-select-hover-list-row-101")).not.toBeNull(),
    );

    /* Three copies, one row: the heading carries the count and the row carries
       the copies, so the row's `data-cy` stays unique in the document. */
    expect(
      document.querySelectorAll('[data-cy="deck-select-hover-list-row-101"]'),
    ).toHaveLength(1);
    expect(cy("deck-select-hover-list-main-heading").textContent).toBe(
      "Main (3)",
    );
    expect(cy("deck-select-hover-list-row-copies-101").textContent).toBe("3");
    expect(
      cy("deck-select-hover-list-row-101").style.getPropertyValue("--fc"),
    ).toBe("#1d9e74");
    expect(find("deck-select-hover-list-row-art-101")).not.toBeNull();
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

  it("hidden floats stay hidden", async () => {
    render(DeckSelectScreen, props());

    await fireEvent.pointerEnter(cy("deck-tile-k1"));
    await waitFor(() => expect(find("deck-select-hover-float")).not.toBeNull());

    const float = cy("deck-select-hover-float");
    float.hidden = true;

    expect(getComputedStyle(float).display).toBe("none");
    /* `vite-plugin-svelte` keeps component CSS out of the jsdom document, so
       the assertion above only proves the user-agent rule still applies — it
       is the author `display` on these classes that beats it, and that is only
       visible in the source. Same reading-by-selector as
       `tests/component/deck-editor/card-tile-art.test.ts`. */
    guarded(SCREEN_SOURCE, ".float");
    guarded(SCREEN_SOURCE, ".dock");
    guarded(SCREEN_SOURCE, ".art-float");
    guarded(PANEL_SOURCE, ".decklist");
  });

  it("no float when narrow", async () => {
    const decklistFor = resolver();
    render(DeckSelectScreen, props({ decklistFor, forceNarrow: true }));

    await fireEvent.pointerEnter(cy("deck-tile-k1"));

    expect(find("deck-select-hover-list")).toBeNull();
    expect(decklistFor).not.toHaveBeenCalled();
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
