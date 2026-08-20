// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShopGreetingScreen from "../../../src/story/shop/ShopGreetingScreen.svelte";

afterEach(() => cleanup());

describe("ShopGreetingScreen", () => {
  it("shopkeeper speaks in beats then offers the menu", async () => {
    const { container } = render(ShopGreetingScreen, { onleave: vi.fn() });
    // First beat visible, menu absent
    expect(screen.getByText(/Welcome in/)).toBeTruthy();
    expect(
      container.querySelector('[data-cy="story-shop-greeting-buy"]'),
    ).toBeNull();
    const root = container.querySelector(
      '[data-cy="story-shop-greeting"]',
    ) as HTMLElement;
    // Advance to second beat
    await fireEvent.click(root);
    expect(screen.getByText(/Selling doubles/)).toBeTruthy();
    // Advance past last beat → menu
    await fireEvent.click(root);
    const buy = container.querySelector(
      '[data-cy="story-shop-greeting-buy"]',
    ) as HTMLButtonElement;
    const sell = container.querySelector(
      '[data-cy="story-shop-greeting-sell"]',
    ) as HTMLButtonElement;
    expect(buy).toBeTruthy();
    expect(sell).toBeTruthy();
    expect(buy.disabled).toBe(false);
    expect(sell.disabled).toBe(false); // T13: sell now enabled
    // Dialogue box gone
    expect(
      container.querySelector('[data-cy="story-shop-greeting-dialogue"]'),
    ).toBeNull();
  });

  it("buy fires onnavigate with buy", async () => {
    const onnavigate = vi.fn();
    const { container } = render(ShopGreetingScreen, {
      onnavigate,
      onleave: vi.fn(),
    });
    const root = container.querySelector(
      '[data-cy="story-shop-greeting"]',
    ) as HTMLElement;
    await fireEvent.click(root);
    await fireEvent.click(root);
    const buy = container.querySelector(
      '[data-cy="story-shop-greeting-buy"]',
    ) as HTMLButtonElement;
    await userEvent.setup().click(buy);
    expect(onnavigate).toHaveBeenCalledWith("buy");
  });

  it("leave returns to the map", async () => {
    const onleave = vi.fn();
    const { container } = render(ShopGreetingScreen, { onleave });
    const root = container.querySelector(
      '[data-cy="story-shop-greeting"]',
    ) as HTMLElement;
    // Advance through both beats
    await fireEvent.click(root);
    await fireEvent.click(root);
    const leaveBtn = container.querySelector(
      '[data-cy="story-shop-greeting-leave"]',
    ) as HTMLButtonElement;
    expect(leaveBtn).toBeTruthy();
    await userEvent.setup().click(leaveBtn);
    expect(onleave).toHaveBeenCalledOnce();
  });
});
