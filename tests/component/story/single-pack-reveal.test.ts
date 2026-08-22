// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import StoryApp from "../../../src/story/StoryApp.svelte";
import BoosterOpeningScreen from "../../../src/story/shop/BoosterOpeningScreen.svelte";
import ShopSellScreen from "../../../src/story/shop/ShopSellScreen.svelte";
import { PACK_SIZE } from "../../../src/story/shop/data/shop-pricing.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";

/* One pack. `feedback-vn.md`, Card Reveal item 4: "Remove the button 'See
   result' or 'skip' if opening only 1 pack. Just have a back button."

   Nine tiles are the whole opening, so a results list that repeats them is a
   second screen showing what the first one already shows, and Skip is a way
   out of a reveal that has nowhere else to go. The one pack keeps one exit.
   Two packs and up keep the set T37 built, which is the other half of what is
   asserted here — the branch is the claim, not the buttons on their own. */

function opened(packs: number) {
  return Array.from({ length: packs * PACK_SIZE }, (_, index) => ({
    code: 100 + index,
    name: `Card ${index}`,
    imageUrl: null as string | null,
    rarity: "common" as ShopRarity,
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

describe("opening a single pack", () => {
  it("offers Back and nothing else, before a card is turned", () => {
    const { container } = render(BoosterOpeningScreen, { cards: opened(1) });

    expect(button(container, "back")).not.toBeNull();
    expect(button(container, "skip")).toBeNull();
    expect(button(container, "see-all")).toBeNull();
    expect(button(container, "next-pack")).toBeNull();
    expect(button(container, "open-all")).toBeNull();
  });

  it("still offers Back and nothing else once the pack is out", async () => {
    const { container } = render(BoosterOpeningScreen, { cards: opened(1) });
    await flipWholePack(container);

    expect(button(container, "back")).not.toBeNull();
    expect(button(container, "skip")).toBeNull();
    expect(button(container, "see-all")).toBeNull();
    expect(
      container.querySelector('[data-cy="story-shop-opening-actions"]'),
    ).toBeNull();
  });

  it("Back is the way out whether or not anything was flipped", async () => {
    const onback = vi.fn();
    const { container } = render(BoosterOpeningScreen, {
      cards: opened(1),
      onback,
    });

    await userEvent.setup().click(button(container, "back")!);
    expect(onback).toHaveBeenCalledOnce();
  });
});

describe("opening more than one pack keeps T37's buttons", () => {
  it("keeps Skip and offers no Back", () => {
    const { container } = render(BoosterOpeningScreen, { cards: opened(3) });

    expect(button(container, "skip")).not.toBeNull();
    expect(button(container, "back")).toBeNull();
  });

  it("keeps Next pack and Open all remaining once a pack is out", async () => {
    const { container } = render(BoosterOpeningScreen, { cards: opened(3) });
    await flipWholePack(container);

    expect(button(container, "next-pack")).not.toBeNull();
    expect(button(container, "open-all")).not.toBeNull();
  });
});

describe("leaving a single-pack reveal early", () => {
  /* The whole point of crediting at open time, walked end to end: the player
     never turns a card over, presses Back, and the nine cards are theirs. */
  it("lands back in the shop with every card kept", async () => {
    const collection = Object.fromEntries(
      opened(1).map(({ code }) => [code, 1]),
    );
    const { container } = render(StoryApp, {
      resumeState: {
        ...createInitialStoryState(),
        screen: "shop-opening" as const,
        savedScreen: "shop-browse" as const,
        progressExists: true,
        shopReturnScreen: "map" as const,
        collection,
        openedCards: opened(1).map(({ code, rarity }) => ({ code, rarity })),
        openingMode: "sequential" as const,
      },
    });

    await waitFor(() =>
      expect(
        container.querySelector('[data-cy="story-shop-opening"]'),
      ).not.toBeNull(),
    );
    await userEvent.setup().click(button(container, "back")!);

    await waitFor(() =>
      expect(
        container.querySelector('[data-cy="story-shop-browse"]'),
      ).not.toBeNull(),
    );
    /* Straight to the sell screen's own reading of the save would need the
       catalog; the collection the shop hands around is the state itself, and
       the browse screen only proves the player got out. What the player kept
       is the model's claim, and `tests/unit/story/credit-at-open.test.ts`
       holds it. */
    expect(
      container.querySelector('[data-cy="story-shop-results"]'),
    ).toBeNull();
  });
});

describe("unopened packs", () => {
  /* Item 5 hands the cards over at open time, which only reads as fair if the
     unopened pack itself is not an asset the player can cash in — buy, sell,
     buy, sell would otherwise be a way to launder a pull. The sell screen
     prices cards and nothing else. */
  it("are not sellable", () => {
    const { container } = render(ShopSellScreen, {
      cards: [
        {
          code: 111,
          name: "Blue-Eyes White Dragon",
          imageUrl: null,
          rarity: "common" as ShopRarity,
          owned: 1,
        },
      ],
      state: {
        ...createInitialStoryState(),
        screen: "shop-sell" as const,
        boosters: { a: 3 },
      },
    });

    expect(
      container.querySelectorAll('[data-cy^="story-shop-sell-card-"]'),
    ).toHaveLength(1);
    expect(
      container.querySelector('[data-cy="story-shop-sell-card-111"]'),
    ).not.toBeNull();
  });
});
