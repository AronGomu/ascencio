// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StoryApp from "../../../src/story/StoryApp.svelte";
import BoosterOpeningScreen from "../../../src/story/shop/BoosterOpeningScreen.svelte";
import BoosterResultsScreen from "../../../src/story/shop/BoosterResultsScreen.svelte";
import { PACK_SIZE } from "../../../src/story/shop/data/shop-pricing.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";

/* Buying more than one pack. The single pack — the flip, the halo, the zoom,
   auto-flip — is `booster-reveal.test.ts`; what is here is the walk from pack
   to pack, the escape hatch out of it, and the list it all ends on. */

const RARITIES: readonly ShopRarity[] = [
  "common",
  "rare",
  "super-rare",
  "ultra-rare",
  "secret-rare",
  "ultimate-rare",
  "ghost-rare",
];

/** `packs` packs' worth of pulls, flat, the way the shop hands them over. No
    `view`, so the zoom inspector stays out of these renders. */
function opened(packs: number) {
  return Array.from({ length: packs * PACK_SIZE }, (_, index) => ({
    code: 100 + index,
    name: `Card ${index}`,
    imageUrl: null as string | null,
    rarity: RARITIES[index % RARITIES.length]!,
  }));
}

function tile(container: HTMLElement, index: number): HTMLButtonElement {
  return container.querySelector(
    `[data-cy="story-shop-opening-card-${index}"]`,
  ) as HTMLButtonElement;
}

function button(
  container: HTMLElement,
  name: string,
): HTMLButtonElement | null {
  return container.querySelector(`[data-cy="story-shop-opening-${name}"]`);
}

function isFaceUp(container: HTMLElement, index: number): boolean {
  return (
    container.querySelector(
      `[data-cy="story-shop-opening-placeholder-${index}"]`,
    ) !== null
  );
}

async function flipWholePack(container: HTMLElement): Promise<void> {
  const user = userEvent.setup();
  for (let index = 0; index < PACK_SIZE; index += 1)
    await user.click(tile(container, index));
}

afterEach(async () => {
  cleanup();
  localStorage.clear();
  await deleteDB(STORY_SAVES_DATABASE_NAME);
});

describe("opening more than one pack", () => {
  /* A pack draws from its pool with replacement, so a repeat inside one pack
     is ordinary rather than exotic — it is the reason the results list counts
     copies. Keying the tile grid on the card instead of the slot throws
     `each_key_duplicate` on exactly this pack. */
  it("deals a pack that drew the same card twice", () => {
    const twice = Array.from({ length: PACK_SIZE }, () => ({
      code: 4007,
      name: "Dark Magician",
      imageUrl: null as string | null,
      rarity: "common" as ShopRarity,
    }));
    const { container } = render(BoosterOpeningScreen, { cards: twice });

    expect(
      container.querySelectorAll('[data-cy^="story-shop-opening-card-"]'),
    ).toHaveLength(PACK_SIZE);
  });

  it("reveals one pack at a time", () => {
    const { container } = render(BoosterOpeningScreen, { cards: opened(3) });

    expect(
      container.querySelectorAll('[data-cy^="story-shop-opening-card-"]'),
    ).toHaveLength(PACK_SIZE);
    expect(
      container.querySelector('[data-cy="story-shop-opening-progress"]')
        ?.textContent,
    ).toContain("Pack 1 of 3");
  });

  it("offers nothing to move on with until the pack is out", async () => {
    const { container } = render(BoosterOpeningScreen, { cards: opened(3) });
    const user = userEvent.setup();

    await user.click(tile(container, 0));
    expect(button(container, "next-pack")).toBeNull();
    expect(button(container, "open-all")).toBeNull();
    expect(button(container, "see-all")).toBeNull();
  });

  it("Next pack deals a fresh face-down pack", async () => {
    const { container } = render(BoosterOpeningScreen, { cards: opened(3) });
    await flipWholePack(container);

    const next = button(container, "next-pack");
    expect(next).not.toBeNull();
    await userEvent.setup().click(next!);

    expect(
      container.querySelector('[data-cy="story-shop-opening-progress"]')
        ?.textContent,
    ).toContain("Pack 2 of 3");
    expect(
      container.querySelectorAll('[data-cy^="story-shop-opening-card-"]'),
    ).toHaveLength(PACK_SIZE);
    for (let index = 0; index < PACK_SIZE; index += 1)
      expect(isFaceUp(container, index)).toBe(false);

    /* The second pack's cards, not the first pack's turned back over. */
    await userEvent.setup().click(tile(container, 0));
    expect(
      container.querySelector('[data-cy="story-shop-opening-name-0"]')
        ?.textContent,
    ).toContain(`Card ${PACK_SIZE}`);
  });

  it("Open all remaining leaves the rest of the packs unturned", async () => {
    const onfinish = vi.fn();
    const { container } = render(BoosterOpeningScreen, {
      cards: opened(3),
      onfinish,
    });
    await flipWholePack(container);

    const openAll = button(container, "open-all");
    expect(openAll).not.toBeNull();
    await userEvent.setup().click(openAll!);

    expect(onfinish).toHaveBeenCalledOnce();
    /* No card-by-card reveal happened on the way: the screen is still showing
       pack 1 and it is the results list that carries the rest. */
    expect(
      container.querySelector('[data-cy="story-shop-opening-progress"]')
        ?.textContent,
    ).toContain("Pack 1 of 3");
  });

  it("the last pack offers See all instead of Next pack", async () => {
    const onfinish = vi.fn();
    const { container } = render(BoosterOpeningScreen, {
      cards: opened(2),
      onfinish,
    });
    await flipWholePack(container);
    await userEvent.setup().click(button(container, "next-pack")!);
    await flipWholePack(container);

    expect(button(container, "next-pack")).toBeNull();
    expect(button(container, "open-all")).toBeNull();
    const seeAll = button(container, "see-all");
    expect(seeAll).not.toBeNull();

    await userEvent.setup().click(seeAll!);
    expect(onfinish).toHaveBeenCalledOnce();
  });

  /* The shop rebuilds its card list whenever anything about the save changes,
     and the catalog lands asynchronously behind this screen — so the array
     arrives again, same codes, richer objects, halfway through a reveal. */
  it("a card list rebuilt mid-reveal keeps the pack and the flips", async () => {
    const cards = opened(3);
    const { container, rerender } = render(BoosterOpeningScreen, { cards });

    await flipWholePack(container);
    await userEvent.setup().click(button(container, "next-pack")!);
    await userEvent.setup().click(tile(container, 0));

    await rerender({ cards: cards.map((card) => ({ ...card, view: null })) });

    expect(
      container.querySelector('[data-cy="story-shop-opening-progress"]')
        ?.textContent,
    ).toContain("Pack 2 of 3");
    expect(isFaceUp(container, 0)).toBe(true);
  });

  it("Open all remaining lands on the results list holding every card", async () => {
    const { container } = render(StoryApp, {
      resumeState: {
        ...createInitialStoryState(),
        screen: "shop-opening" as const,
        savedScreen: "shop-browse" as const,
        progressExists: true,
        shopReturnScreen: "map" as const,
        openedCards: opened(2).map(({ code, rarity }) => ({ code, rarity })),
        openingMode: "sequential" as const,
      },
    });

    await waitFor(() =>
      expect(
        container.querySelector('[data-cy="story-shop-opening"]'),
      ).not.toBeNull(),
    );
    await flipWholePack(container);
    await userEvent.setup().click(button(container, "open-all")!);

    await waitFor(() =>
      expect(
        container.querySelector('[data-cy="story-shop-results"]'),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector('[data-cy="story-top-bar-title"]')?.textContent,
    ).toContain(`${2 * PACK_SIZE}`);
    expect(
      container.querySelectorAll('[data-cy^="story-shop-result-tile-"]'),
    ).toHaveLength(2 * PACK_SIZE);
  });
});

/* The zoom is pinned on pack one by `booster-reveal.test.ts`. Pack two is a
   different claim: the nine tiles are reused rather than rebuilt, and the
   anchor the zoom grows from is a `bind:this` on the art box inside them. */
describe("the zoom after a pack change", () => {
  function view(code: number, name: string): DeckBuilderCardView {
    return {
      code,
      name,
      description: `${name} effect text`,
      family: "monster",
      subtypes: ["Normal"],
      attribute: "DARK",
      race: "Spellcaster",
      levelRankLink: 4,
      ratingLabel: "Level",
      attack: 1200,
      defense: 1000,
      pendulumScales: null,
      linkMarkers: [],
      canonicalZone: "main",
      imageUrl: null,
      scope: 3,
      rawType: 1,
    };
  }

  /* Svelte measures the zoom window's height through a `ResizeObserver`,
     which jsdom does not implement. */
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        readonly observe = vi.fn();
        readonly disconnect = vi.fn();
        readonly unobserve = vi.fn();
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("still magnifies a card on the second pack", async () => {
    const cards = opened(2).map((card, index) => ({
      ...card,
      view: view(card.code, `Card ${index}`),
    }));
    const { container } = render(BoosterOpeningScreen, { cards });

    await flipWholePack(container);
    const user = userEvent.setup();
    await user.click(button(container, "next-pack")!);
    await user.click(tile(container, 0));
    await user.hover(tile(container, 0));

    expect(
      container.querySelector('[data-cy="card-zoom-inspector"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="card-zoom-inspector-name"]')
        ?.textContent,
    ).toContain(`Card ${PACK_SIZE}`);
  });
});

describe("the results list", () => {
  const noop = () => undefined;

  function results(
    cards: readonly {
      code: number;
      name: string;
      imageUrl: string | null;
      rarity: ShopRarity;
    }[],
  ) {
    return render(BoosterResultsScreen, { cards, oncontinue: noop }).container;
  }

  it("collapses duplicates into one tile with a quantity", () => {
    const kuriboh = {
      code: 40640057,
      name: "Kuriboh",
      imageUrl: null,
      rarity: "common" as ShopRarity,
    };
    const container = results([kuriboh, kuriboh, kuriboh]);

    expect(
      container.querySelectorAll('[data-cy^="story-shop-result-tile-"]'),
    ).toHaveLength(1);
    expect(
      container.querySelector(
        '[data-cy="story-shop-results-quantity-40640057"]',
      )?.textContent,
    ).toContain("3");
  });

  it("gives a card pulled once no quantity badge", () => {
    const container = results([
      {
        code: 12345,
        name: "Raigeki",
        imageUrl: null,
        rarity: "super-rare" as ShopRarity,
      },
    ]);

    expect(
      container.querySelector('[data-cy="story-shop-result-tile-12345"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="story-shop-results-quantity-12345"]'),
    ).toBeNull();
  });

  it("carries the set list's tri-state rarity grouping", async () => {
    const container = results([
      {
        code: 1,
        name: "Zombyra",
        imageUrl: null,
        rarity: "ultra-rare" as ShopRarity,
      },
      {
        code: 2,
        name: "Alpha",
        imageUrl: null,
        rarity: "common" as ShopRarity,
      },
    ]);
    const user = userEvent.setup();
    const sort = container.querySelector(
      '[data-cy="story-shop-results-rarity-sort"]',
    ) as HTMLButtonElement;

    expect(sort.dataset["state"]).toBe("off");
    expect(
      container.querySelectorAll('[data-cy^="story-shop-results-group-"]'),
    ).toHaveLength(0);

    await user.click(sort);
    expect(sort.dataset["state"]).toBe("common-first");
    expect(
      [
        ...container.querySelectorAll('[data-cy^="story-shop-results-group-"]'),
      ].map((heading) => heading.getAttribute("data-cy")),
    ).toEqual([
      "story-shop-results-group-common",
      "story-shop-results-group-ultra-rare",
    ]);

    await user.click(sort);
    expect(sort.dataset["state"]).toBe("rarest-first");
    expect(
      [
        ...container.querySelectorAll('[data-cy^="story-shop-results-group-"]'),
      ].map((heading) => heading.getAttribute("data-cy")),
    ).toEqual([
      "story-shop-results-group-ultra-rare",
      "story-shop-results-group-common",
    ]);

    await user.click(sort);
    expect(sort.dataset["state"]).toBe("off");
    expect(
      container.querySelectorAll('[data-cy^="story-shop-results-group-"]'),
    ).toHaveLength(0);
  });
});
