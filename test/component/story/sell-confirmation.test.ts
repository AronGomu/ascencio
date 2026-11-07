// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShopSellScreen from "../../../src/story/shop/ShopSellScreen.svelte";
import {
  createInitialStoryState,
  type StoryDeck,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";

afterEach(() => cleanup());

/* Selling is irreversible and unrestricted: the dialog informs, it never
   refuses. What it is proving here is that the sale reaches the reducer only
   once the player has seen which decks it would leave illegal (ADR-050). */

const BLUE_EYES = 89631139;
const RAIGEKI = 12580477;

const CARDS = [
  {
    code: BLUE_EYES,
    name: "Blue-Eyes White Dragon",
    imageUrl: null,
    rarity: "secret-rare" as const,
    owned: 2,
  },
  {
    code: RAIGEKI,
    name: "Raigeki",
    imageUrl: null,
    rarity: "rare" as const,
    owned: 1,
  },
] as const;

const DRAGONS: StoryDeck = storyDeckFixture("dragons", {
  name: "White Dragons",
  main: [BLUE_EYES, BLUE_EYES],
});

function saveWith(decks: readonly StoryDeck[]): StoryState {
  return Object.freeze({
    ...createInitialStoryState(),
    collection: { [BLUE_EYES]: 2, [RAIGEKI]: 1 },
    decks,
  });
}

/** One copy of `code` into the stepper, then Sell. */
async function sell(
  container: HTMLElement,
  code: number,
): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.click(
    container.querySelector(
      `[data-cy="story-shop-sell-plus-${code}"]`,
    ) as HTMLElement,
  );
  await user.click(
    container.querySelector(
      '[data-cy="story-shop-sell-confirm"]',
    ) as HTMLElement,
  );
  return user;
}

describe("sell confirmation", () => {
  it("the dialog appears before the sale", async () => {
    const onsell = vi.fn();
    const { container } = render(ShopSellScreen, {
      cards: CARDS,
      state: saveWith([DRAGONS]),
      onsell,
    });

    await sell(container, BLUE_EYES);

    const dialog = container.querySelector(
      '[data-cy="story-sell-impact-dialog"]',
    );
    expect(dialog).not.toBeNull();
    expect(onsell).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-cy="story-sell-impact-deck-dragons"]')
        ?.textContent,
    ).toContain("White Dragons");
    expect(
      container.querySelector(
        '[data-cy="story-sell-impact-deck-cards-dragons"]',
      )?.textContent,
    ).toContain("Blue-Eyes White Dragon");
  });

  it("confirming commits the sale", async () => {
    const onsell = vi.fn();
    const { container } = render(ShopSellScreen, {
      cards: CARDS,
      state: saveWith([DRAGONS]),
      onsell,
    });

    const user = await sell(container, BLUE_EYES);
    await user.click(
      container.querySelector(
        '[data-cy="story-sell-impact-confirm"]',
      ) as HTMLElement,
    );

    expect(onsell).toHaveBeenCalledOnce();
    expect(onsell).toHaveBeenCalledWith([
      { code: BLUE_EYES, quantity: 1, rarity: "secret-rare" },
    ]);
    expect(
      container.querySelector('[data-cy="story-sell-impact-dialog"]'),
    ).toBeNull();
  });

  it("cancelling changes nothing", async () => {
    const onsell = vi.fn();
    const { container } = render(ShopSellScreen, {
      cards: CARDS,
      state: saveWith([DRAGONS]),
      onsell,
    });

    const user = await sell(container, BLUE_EYES);
    const cancel = container.querySelector(
      '[data-cy="story-sell-impact-cancel"]',
    ) as HTMLButtonElement;
    /* The red one is the way out of the sale, not the way through it, and it
       is the one focus lands on: a stray Enter must not spend the cards. */
    expect(cancel.classList.contains("danger")).toBe(true);
    expect(document.activeElement).toBe(cancel);
    await user.click(cancel);

    expect(onsell).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-cy="story-sell-impact-dialog"]'),
    ).toBeNull();
    expect(
      container.querySelector(
        `[data-cy="story-shop-sell-selected-${BLUE_EYES}"]`,
      )?.textContent,
    ).toBe("1");
    /* Focus comes back to the button that opened the dialog rather than to the
       top of the document, as it does on the save-delete confirmation. */
    expect(document.activeElement).toBe(
      container.querySelector('[data-cy="story-shop-sell-confirm"]'),
    );
  });

  /* A confirmation that fires on a sale which breaks nothing teaches the
     player to click through the one that matters. */
  it("a harmless sale skips the dialog", async () => {
    const onsell = vi.fn();
    const { container } = render(ShopSellScreen, {
      cards: CARDS,
      state: saveWith([DRAGONS]),
      onsell,
    });

    await sell(container, RAIGEKI);

    expect(
      container.querySelector('[data-cy="story-sell-impact-dialog"]'),
    ).toBeNull();
    expect(onsell).toHaveBeenCalledOnce();
    expect(onsell).toHaveBeenCalledWith([
      { code: RAIGEKI, quantity: 1, rarity: "rare" },
    ]);
  });

  /* Free play and the component tests render this screen with no save behind
     it. Nothing to break there, so nothing to warn about. */
  it("a screen with no save behind it sells straight through", async () => {
    const onsell = vi.fn();
    const { container } = render(ShopSellScreen, { cards: CARDS, onsell });

    await sell(container, BLUE_EYES);

    expect(
      container.querySelector('[data-cy="story-sell-impact-dialog"]'),
    ).toBeNull();
    expect(onsell).toHaveBeenCalledOnce();
  });

  it("escape leaves the sale untaken", async () => {
    const onsell = vi.fn();
    const { container } = render(ShopSellScreen, {
      cards: CARDS,
      state: saveWith([DRAGONS]),
      onsell,
    });

    const user = await sell(container, BLUE_EYES);
    await user.keyboard("{Escape}");

    expect(onsell).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-cy="story-sell-impact-dialog"]'),
    ).toBeNull();
  });
});
