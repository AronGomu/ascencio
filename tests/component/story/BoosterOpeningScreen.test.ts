// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoosterOpeningScreen from "../../../src/story/shop/BoosterOpeningScreen.svelte";

/* The single pack — face-down start, the flip, the halo, the zoom, auto-flip
   and the layout — is `booster-reveal.test.ts`, and the walk from pack to pack
   is `booster-open-all.test.ts`. What is left here is the boundary between the
   two: what finishing a pack does and does not do on its own. */

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
  it("the last card of a pack does not advance the counter by itself", async () => {
    /* The player decides when the next pack is dealt: a counter that ticked
       over on the ninth flip would leave the pack they were still reading
       labelled as the one after it. */
    const user = userEvent.setup();
    const cards = makeCards(18);
    const { container } = render(BoosterOpeningScreen, { cards });

    const progress = container.querySelector(
      '[data-cy="story-shop-opening-progress"]',
    );
    expect(progress?.textContent).toContain("Pack 1 of 2");

    for (let i = 0; i < PACK_SIZE; i++) await user.click(tile(container, i));

    expect(progress?.textContent).toContain("Pack 1 of 2");
  });

  it("see all appears after the last card of the last pack", async () => {
    const user = userEvent.setup();
    const onfinish = vi.fn();
    const cards = makeCards(18);
    const { container } = render(BoosterOpeningScreen, { cards, onfinish });

    for (let i = 0; i < PACK_SIZE; i++) await user.click(tile(container, i));
    expect(
      container.querySelector('[data-cy="story-shop-opening-see-all"]'),
    ).toBeNull();

    await user.click(
      container.querySelector(
        '[data-cy="story-shop-opening-next-pack"]',
      ) as HTMLButtonElement,
    );
    for (let i = 0; i < PACK_SIZE - 1; i++)
      await user.click(tile(container, i));
    expect(
      container.querySelector('[data-cy="story-shop-opening-see-all"]'),
    ).toBeNull();

    await user.click(tile(container, PACK_SIZE - 1));
    const seeAllBtn = container.querySelector(
      '[data-cy="story-shop-opening-see-all"]',
    ) as HTMLButtonElement;
    expect(seeAllBtn).not.toBeNull();

    await user.click(seeAllBtn);
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
