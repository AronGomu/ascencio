// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShopBrowseScreen from "../../../src/story/shop/ShopBrowseScreen.svelte";
import type { ShopSetEntry } from "../../../src/story/shop/data/shop-set-data.ts";

afterEach(() => cleanup());

const RELEASED_SET = (id: string, name: string, year = 2002): ShopSetEntry => ({
  id,
  name,
  releaseYear: year,
  released: true,
  cards: [],
});

const UNRELEASED_SET = (
  id: string,
  name: string,
  year = 2024,
): ShopSetEntry => ({
  id,
  name,
  releaseYear: year,
  released: false,
  cards: [],
});

const FOUR_SETS: readonly ShopSetEntry[] = [
  RELEASED_SET("lob", "Legend of Blue-Eyes White Dragon", 2002),
  RELEASED_SET("mrd", "Metal Raiders", 2002),
  RELEASED_SET("psv", "Pharaoh's Servant", 2002),
  UNRELEASED_SET("toci", "The Infinite Forbidden", 2024),
];

const noop = () => undefined;

describe("ShopBrowseScreen", () => {
  it("loading state shows until data lands", () => {
    const { container } = render(ShopBrowseScreen, {
      sets: null,
      error: null,
      dp: 1000,
      onbuy: noop,
      onback: noop,
    });
    expect(
      container.querySelector('[data-cy="story-shop-browse-loading"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="story-shop-set-grid"]'),
    ).toBeNull();
  });

  it("error state offers retry", async () => {
    const onretry = vi.fn();
    const { container } = render(ShopBrowseScreen, {
      sets: null,
      error: "offline",
      dp: 1000,
      onbuy: noop,
      onretry,
      onback: noop,
    });
    expect(
      container.querySelector('[data-cy="story-shop-browse-error"]'),
    ).not.toBeNull();
    const btn = container.querySelector(
      '[data-cy="story-shop-browse-retry"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    await userEvent.setup().click(btn);
    expect(onretry).toHaveBeenCalledOnce();
  });

  it("latest released row lists the newest sets oldest first", () => {
    const { container } = render(ShopBrowseScreen, {
      sets: FOUR_SETS,
      error: null,
      dp: 1000,
      onbuy: noop,
      onback: noop,
    });
    const row = container.querySelector(
      '[data-cy="story-shop-latest-row"]',
    ) as HTMLElement;
    expect(row).not.toBeNull();
    const tiles = [
      ...row.querySelectorAll<HTMLElement>(
        "button[data-cy^='story-shop-latest-']",
      ),
    ];
    expect(tiles.length).toBe(3);
    // chronological: lob → mrd → psv
    expect(tiles[0]!.dataset["cy"]).toBe("story-shop-latest-lob");
    expect(tiles[1]!.dataset["cy"]).toBe("story-shop-latest-mrd");
    expect(tiles[2]!.dataset["cy"]).toBe("story-shop-latest-psv");
    // unreleased absent from row
    expect(row.querySelector('[data-cy="story-shop-latest-toci"]')).toBeNull();
  });

  it("unreleased sets are inert", async () => {
    const onbuy = vi.fn();
    const { container } = render(ShopBrowseScreen, {
      sets: FOUR_SETS,
      error: null,
      dp: 1000,
      onbuy,
      onback: noop,
    });
    const unreleased = container.querySelector(
      '[data-cy="story-shop-set-toci"]',
    ) as HTMLButtonElement;
    expect(unreleased).not.toBeNull();
    await fireEvent.click(unreleased);
    // no dialog opened
    expect(
      container.querySelector('[data-cy="story-overlay-shop-set-title"]'),
    ).toBeNull();
    expect(onbuy).not.toHaveBeenCalled();
  });

  it("buy ten through the dialog", async () => {
    const onbuy = vi.fn();
    const sets: readonly ShopSetEntry[] = [
      RELEASED_SET("metal-raiders", "Metal Raiders"),
    ];
    const { container } = render(ShopBrowseScreen, {
      sets,
      error: null,
      dp: 2000,
      onbuy,
      onback: noop,
    });
    const tile = container.querySelector(
      '[data-cy="story-shop-set-metal-raiders"]',
    ) as HTMLButtonElement;
    expect(tile).not.toBeNull();
    await userEvent.setup().click(tile);
    const buyTen = container.querySelector(
      '[data-cy="story-shop-buy-ten"]',
    ) as HTMLButtonElement;
    expect(buyTen).not.toBeNull();
    expect(buyTen.disabled).toBe(false);
    await userEvent.setup().click(buyTen);
    expect(onbuy).toHaveBeenCalledWith("metal-raiders", 10);
  });

  it("custom amount buys that amount", async () => {
    const onbuy = vi.fn();
    const sets: readonly ShopSetEntry[] = [
      RELEASED_SET("metal-raiders", "Metal Raiders"),
    ];
    const { container } = render(ShopBrowseScreen, {
      sets,
      error: null,
      dp: 1000,
      onbuy,
      onback: noop,
    });
    await userEvent
      .setup()
      .click(
        container.querySelector(
          '[data-cy="story-shop-set-metal-raiders"]',
        ) as HTMLElement,
      );
    const input = container.querySelector(
      '[data-cy="story-shop-buy-custom-input"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, "3");
    const buyCustom = container.querySelector(
      '[data-cy="story-shop-buy-custom"]',
    ) as HTMLButtonElement;
    await userEvent.setup().click(buyCustom);
    expect(onbuy).toHaveBeenCalledWith("metal-raiders", 3);
  });

  it("poor wallet disables buying", async () => {
    const sets: readonly ShopSetEntry[] = [
      RELEASED_SET("metal-raiders", "Metal Raiders"),
    ];
    const { container } = render(ShopBrowseScreen, {
      sets,
      error: null,
      dp: 50,
      onbuy: noop,
      onback: noop,
    });
    await userEvent
      .setup()
      .click(
        container.querySelector(
          '[data-cy="story-shop-set-metal-raiders"]',
        ) as HTMLElement,
      );
    const buyOne = container.querySelector(
      '[data-cy="story-shop-buy-one"]',
    ) as HTMLButtonElement;
    const buyTen = container.querySelector(
      '[data-cy="story-shop-buy-ten"]',
    ) as HTMLButtonElement;
    expect(buyOne.disabled).toBe(true);
    expect(buyTen.disabled).toBe(true);
    expect(
      container.querySelector('[data-cy="story-shop-buy-error"]'),
    ).not.toBeNull();
  });
});
