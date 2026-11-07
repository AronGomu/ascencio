// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShopGreetingScreen from "../../../src/story/shop/ShopGreetingScreen.svelte";
import StoryTopBar from "../../../src/story/components/StoryTopBar.svelte";
import OverlayShell from "../../../src/story/overlays/OverlayShell.svelte";

afterEach(() => cleanup());

describe("ShopGreetingScreen", () => {
  it.each(["{Enter}", " "])(
    "preserves focused control activation for %s",
    async (key) => {
      render(ShopGreetingScreen);
      const activate = vi.fn();
      render(StoryTopBar, { onsettings: activate });
      screen.getByRole("button", { name: "Open settings" }).focus();

      await userEvent.setup().keyboard(key);

      expect(activate).toHaveBeenCalledOnce();
      expect(screen.getByText(/Welcome in/)).toBeTruthy();
    },
  );

  it.each(["Enter", " "])(
    "ignores %s inside a dialog, including non-control focus",
    async (key) => {
      render(ShopGreetingScreen);
      render(OverlayShell, { title: "Settings" });
      const dialog = screen.getByRole("dialog");
      const button = screen.getByRole("button", { name: "Close Settings" });
      for (const target of [button, dialog]) {
        target.focus();
        const event = new KeyboardEvent("keydown", {
          key,
          bubbles: true,
          cancelable: true,
        });
        await fireEvent(target, event);
        expect(event.defaultPrevented).toBe(false);
        expect(screen.getByText(/Welcome in/)).toBeTruthy();
      }
    },
  );

  it.each(["Enter", " "])(
    "honors consumed/repeated %s, then advances the bare stage",
    async (key) => {
      const { container } = render(ShopGreetingScreen);
      const stage = container.querySelector('[data-cy="story-shop-greeting"]')!;
      const consumed = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      consumed.preventDefault();
      await fireEvent(stage, consumed);
      await fireEvent.keyDown(stage, { key, repeat: true });
      expect(screen.getByText(/Welcome in/)).toBeTruthy();
      await fireEvent.keyDown(stage, { key });
      expect(screen.getByText(/Selling doubles/)).toBeTruthy();
      await fireEvent.keyDown(stage, { key });
      expect(screen.getByRole("button", { name: "Buy Cards" })).toBeTruthy();
    },
  );

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
