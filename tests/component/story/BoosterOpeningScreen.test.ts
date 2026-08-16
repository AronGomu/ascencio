// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoosterOpeningScreen from "../../../src/story/shop/BoosterOpeningScreen.svelte";

const PACK_SIZE = 9;

function makeCards(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    code: 100 + i,
    name: `Card ${i}`,
    imageUrl: null as null,
    rarity: "common" as const,
  }));
}

afterEach(cleanup);

describe("BoosterOpeningScreen", () => {
  it("reveals cards one by one", async () => {
    const user = userEvent.setup();
    const cards = makeCards(18);
    const { container } = render(BoosterOpeningScreen, { cards });

    expect(
      container.querySelector('[data-cy="story-shop-opening-card-0"]'),
    ).toBeNull();

    const progress = container.querySelector(
      '[data-cy="story-shop-opening-progress"]',
    );
    expect(progress?.textContent).toContain("Pack 1 of 2");

    const stage = container.querySelector(
      '[data-cy="story-shop-opening"]',
    ) as HTMLElement;
    await user.click(stage);

    const card0 = container.querySelector(
      '[data-cy="story-shop-opening-card-0"]',
    ) as HTMLElement;
    expect(card0).not.toBeNull();
    expect(card0.dataset["rarity"]).toBe("common");
    expect(progress?.textContent).toContain("Pack 1 of 2");
  });

  it("pack boundary advances the pack counter", async () => {
    const user = userEvent.setup();
    const cards = makeCards(18);
    const { container } = render(BoosterOpeningScreen, { cards });

    const stage = container.querySelector(
      '[data-cy="story-shop-opening"]',
    ) as HTMLElement;
    const progress = container.querySelector(
      '[data-cy="story-shop-opening-progress"]',
    );

    for (let i = 0; i < PACK_SIZE; i++) {
      await user.click(stage);
    }

    expect(progress?.textContent).toContain("Pack 2 of 2");
  });

  it("finish appears after the last card", async () => {
    const user = userEvent.setup();
    const onfinish = vi.fn();
    const cards = makeCards(18);
    const { container } = render(BoosterOpeningScreen, { cards, onfinish });

    const stage = container.querySelector(
      '[data-cy="story-shop-opening"]',
    ) as HTMLElement;

    for (let i = 0; i < 18; i++) {
      await user.click(stage);
    }

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

    const stage = container.querySelector(
      '[data-cy="story-shop-opening"]',
    ) as HTMLElement;

    for (let i = 0; i < 3; i++) {
      await user.click(stage);
    }

    const skipBtn = container.querySelector(
      '[data-cy="story-shop-opening-skip"]',
    ) as HTMLButtonElement;
    expect(skipBtn).not.toBeNull();
    await user.click(skipBtn);
    expect(onfinish).toHaveBeenCalledOnce();
  });
});
