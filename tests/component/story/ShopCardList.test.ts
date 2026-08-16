// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShopCardListScreen from "../../../src/story/shop/ShopCardListScreen.svelte";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";

afterEach(() => cleanup());

type CardEntry = {
  code: number;
  name: string;
  imageUrl: string | null;
  rarity: ShopRarity;
  priceDp: number;
};

const FIVE_CARDS: readonly CardEntry[] = [
  {
    code: 111,
    name: "Blue-Eyes White Dragon",
    imageUrl: "/art/111.jpg",
    rarity: "common",
    priceDp: 40,
  },
  {
    code: 222,
    name: "Dark Magician",
    imageUrl: null,
    rarity: "rare",
    priceDp: 100,
  },
  {
    code: 333,
    name: "Exodia the Forbidden One",
    imageUrl: "/art/333.jpg",
    rarity: "ultra-rare",
    priceDp: 400,
  },
  {
    code: 444,
    name: "Summoned Skull",
    imageUrl: "/art/444.jpg",
    rarity: "super-rare",
    priceDp: 200,
  },
  {
    code: 555,
    name: "Red-Eyes Black Dragon",
    imageUrl: "/art/555.jpg",
    rarity: "secret-rare",
    priceDp: 1000,
  },
];

const noop = () => undefined;

describe("ShopCardListScreen", () => {
  it("grid renders one halo tile per card", () => {
    const { container } = render(ShopCardListScreen, {
      setName: "Legend of Blue-Eyes White Dragon",
      dp: 9999,
      cards: FIVE_CARDS,
      onbuysingle: noop,
      onback: noop,
    });
    for (const card of FIVE_CARDS) {
      const tile = container.querySelector(
        `[data-cy="story-shop-card-${card.code}"]`,
      );
      expect(tile, `tile for code ${card.code}`).not.toBeNull();
      expect(
        tile!.classList.contains("rarity-halo"),
        `rarity-halo class on ${card.code}`,
      ).toBe(true);
      expect(
        (tile as HTMLElement).dataset["rarity"],
        `data-rarity on ${card.code}`,
      ).toBe(card.rarity);
    }
  });

  it("card without imageUrl shows placeholder", () => {
    const { container } = render(ShopCardListScreen, {
      setName: "LOB",
      dp: 9999,
      cards: FIVE_CARDS,
      onbuysingle: noop,
      onback: noop,
    });
    expect(
      container.querySelector('[data-cy="story-shop-card-placeholder-222"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="story-shop-card-art-222"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="story-shop-card-art-111"]'),
    ).not.toBeNull();
  });

  it("hover fills the preview", async () => {
    const { container } = render(ShopCardListScreen, {
      setName: "LOB",
      dp: 9999,
      cards: FIVE_CARDS,
      onbuysingle: noop,
      onback: noop,
    });
    await fireEvent.mouseEnter(
      container.querySelector('[data-cy="story-shop-card-333"]')!,
    );
    expect(
      (
        container.querySelector(
          '[data-cy="story-shop-cards-preview-name"]',
        ) as HTMLElement
      ).textContent,
    ).toBe("Exodia the Forbidden One");
    expect(
      (
        container.querySelector(
          '[data-cy="story-shop-cards-preview-rarity"]',
        ) as HTMLElement
      ).textContent,
    ).toBe("ultra-rare");
  });

  it("buy single hands code and rarity out", async () => {
    const onbuysingle = vi.fn();
    const { container } = render(ShopCardListScreen, {
      setName: "LOB",
      dp: 9999,
      cards: FIVE_CARDS,
      onbuysingle,
      onback: noop,
    });
    const btn = container.querySelector(
      '[data-cy="story-shop-card-buy-111"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent!.trim()).toBe("40 DP");
    await userEvent.setup().click(btn);
    expect(onbuysingle).toHaveBeenCalledWith(111, "common");
  });

  it("poor wallet disables singles", () => {
    const { container } = render(ShopCardListScreen, {
      setName: "LOB",
      dp: 5,
      cards: FIVE_CARDS,
      onbuysingle: noop,
      onback: noop,
    });
    for (const card of FIVE_CARDS) {
      const btn = container.querySelector(
        `[data-cy="story-shop-card-buy-${card.code}"]`,
      ) as HTMLButtonElement;
      expect(btn.disabled, `buy disabled for ${card.code}`).toBe(true);
    }
  });

  it("back returns to the browser", async () => {
    const onback = vi.fn();
    const { container } = render(ShopCardListScreen, {
      setName: "LOB",
      dp: 0,
      cards: FIVE_CARDS,
      onbuysingle: noop,
      onback,
    });
    await userEvent
      .setup()
      .click(
        container.querySelector(
          '[data-cy="story-shop-cards-back"]',
        ) as HTMLElement,
      );
    expect(onback).toHaveBeenCalledOnce();
  });
});
