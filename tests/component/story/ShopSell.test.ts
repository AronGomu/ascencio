// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShopSellScreen from "../../../src/story/shop/ShopSellScreen.svelte";

afterEach(() => cleanup());

const CARDS = [
  {
    code: 111,
    name: "Blue-Eyes White Dragon",
    imageUrl: null,
    rarity: "common" as const,
    owned: 3,
    unitPriceDp: 10,
  },
  {
    code: 222,
    name: "Dark Magician",
    imageUrl: null,
    rarity: "rare" as const,
    owned: 1,
    unitPriceDp: 25,
  },
  {
    code: 333,
    name: "Exodia the Forbidden One",
    imageUrl: null,
    rarity: "ultra-rare" as const,
    owned: 2,
    unitPriceDp: 100,
  },
] as const;

const noop = () => undefined;

describe("ShopSellScreen", () => {
  it("lists owned cards with price and halo", () => {
    const { container } = render(ShopSellScreen, {
      cards: CARDS,
      onsell: noop,
      onback: noop,
    });
    for (const card of CARDS) {
      const tile = container.querySelector(
        `[data-cy="story-shop-sell-card-${card.code}"]`,
      ) as HTMLElement | null;
      expect(tile, `tile for ${card.code}`).not.toBeNull();
      expect(
        tile!.classList.contains("rarity-halo"),
        `rarity-halo on ${card.code}`,
      ).toBe(true);
      expect(tile!.dataset["rarity"], `data-rarity on ${card.code}`).toBe(
        card.rarity,
      );
      expect(
        container.querySelector(
          `[data-cy="story-shop-sell-price-${card.code}"]`,
        )?.textContent,
        `price for ${card.code}`,
      ).toContain(String(card.unitPriceDp));
    }
  });

  it("steppers cap at owned and total tracks", async () => {
    const user = userEvent.setup();
    const { container } = render(ShopSellScreen, {
      cards: [CARDS[1]],
      onsell: noop,
      onback: noop,
    });
    const plus = container.querySelector(
      '[data-cy="story-shop-sell-plus-222"]',
    ) as HTMLButtonElement;
    const minus = container.querySelector(
      '[data-cy="story-shop-sell-minus-222"]',
    ) as HTMLButtonElement;
    const readout = container.querySelector(
      '[data-cy="story-shop-sell-selected-222"]',
    )!;
    const totalEl = container.querySelector(
      '[data-cy="story-shop-sell-total"]',
    )!;

    expect(minus.disabled).toBe(true);
    await user.click(plus);
    expect(readout.textContent).toBe("1");
    expect(plus.disabled).toBe(true);
    await user.click(plus);
    expect(readout.textContent).toBe("1");
    expect(totalEl.textContent).toContain("25");
  });

  it("sell hands the receipt out", async () => {
    const user = userEvent.setup();
    const onsell = vi.fn();
    const { container } = render(ShopSellScreen, {
      cards: [CARDS[0], CARDS[1]],
      onsell,
      onback: noop,
    });
    const plus111 = container.querySelector(
      '[data-cy="story-shop-sell-plus-111"]',
    ) as HTMLButtonElement;
    const plus222 = container.querySelector(
      '[data-cy="story-shop-sell-plus-222"]',
    ) as HTMLButtonElement;

    await user.click(plus111);
    await user.click(plus111);
    await user.click(plus222);

    const confirm = container.querySelector(
      '[data-cy="story-shop-sell-confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(onsell).toHaveBeenCalledOnce();
    expect(onsell).toHaveBeenCalledWith([
      { code: 111, quantity: 2, unitPriceDp: 10 },
      { code: 222, quantity: 1, unitPriceDp: 25 },
    ]);
  });

  it("back returns to the keeper", async () => {
    const onback = vi.fn();
    const { container } = render(ShopSellScreen, {
      cards: CARDS,
      onsell: noop,
      onback,
    });
    await userEvent
      .setup()
      .click(
        container.querySelector(
          '[data-cy="story-shop-sell-back"]',
        ) as HTMLElement,
      );
    expect(onback).toHaveBeenCalledOnce();
  });
});
