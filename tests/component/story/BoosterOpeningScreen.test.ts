// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoosterOpeningScreen from "../../../src/story/shop/BoosterOpeningScreen.svelte";

/* The single pack — face-down start, the flip, the halo, the zoom, auto-flip
   and the layout — is `booster-reveal.test.ts`. What is left here is what only
   more than one pack at a time can show. */

const PACK_SIZE = 9;

function makeCards(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    code: 100 + i,
    name: `Card ${i}`,
    imageUrl: null as null,
    rarity: "common" as const,
  }));
}

function tile(container: HTMLElement, index: number): HTMLButtonElement {
  return container.querySelector(
    `[data-cy="story-shop-opening-card-${index}"]`,
  ) as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("BoosterOpeningScreen", () => {
  it("pack boundary advances the pack counter", async () => {
    const user = userEvent.setup();
    const cards = makeCards(18);
    const { container } = render(BoosterOpeningScreen, { cards });

    const progress = container.querySelector(
      '[data-cy="story-shop-opening-progress"]',
    );
    expect(progress?.textContent).toContain("Pack 1 of 2");

    for (let i = 0; i < PACK_SIZE; i++) await user.click(tile(container, i));

    expect(progress?.textContent).toContain("Pack 2 of 2");
  });

  it("finish appears after the last card of the last pack", async () => {
    const user = userEvent.setup();
    const onfinish = vi.fn();
    const cards = makeCards(18);
    const { container } = render(BoosterOpeningScreen, { cards, onfinish });

    for (let i = 0; i < 17; i++) await user.click(tile(container, i));
    expect(
      container.querySelector('[data-cy="story-shop-opening-finish"]'),
    ).toBeNull();

    await user.click(tile(container, 17));
    const finishBtn = container.querySelector(
      '[data-cy="story-shop-opening-finish"]',
    ) as HTMLButtonElement;
    expect(finishBtn).not.toBeNull();

    await user.click(finishBtn);
    expect(onfinish).toHaveBeenCalledOnce();
  });

  it("skip bails out immediately", async () => {
    const user = userEvent.setup();
    const onfinish = vi.fn();
    const cards = makeCards(18);
    const { container } = render(BoosterOpeningScreen, { cards, onfinish });

    for (let i = 0; i < 3; i++) await user.click(tile(container, i));

    const skipBtn = container.querySelector(
      '[data-cy="story-shop-opening-skip"]',
    ) as HTMLButtonElement;
    expect(skipBtn).not.toBeNull();
    await user.click(skipBtn);
    expect(onfinish).toHaveBeenCalledOnce();
  });
});
