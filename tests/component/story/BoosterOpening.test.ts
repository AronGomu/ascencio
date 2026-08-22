// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import StoryApp from "../../../src/story/StoryApp.svelte";
import BoosterInventoryDialog from "../../../src/story/shop/BoosterInventoryDialog.svelte";
import BoosterResultsScreen from "../../../src/story/shop/BoosterResultsScreen.svelte";

afterEach(async () => {
  cleanup();
  await deleteDB(STORY_SAVES_DATABASE_NAME);
});

describe("BoosterOpening", () => {
  it("booster chip counts every pack", () => {
    const shopState = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      savedScreen: "shop-browse" as const,
      boosters: { a: 2, b: 1 },
    };
    const { container } = render(StoryApp, { resumeState: shopState });
    const chip = container.querySelector('[data-cy="story-top-bar-boosters"]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain("3 packs");
  });

  it("dialog steppers stay within owned", async () => {
    const user = userEvent.setup();
    const { container } = render(BoosterInventoryDialog, {
      boosters: { lob: 2 },
      setNameOf: (id: string) => id,
    });
    const plusBtn = container.querySelector(
      '[data-cy="story-shop-booster-plus-lob"]',
    ) as HTMLButtonElement;
    const readout = container.querySelector(
      '[data-cy="story-shop-booster-selected-lob"]',
    );
    expect(readout).not.toBeNull();
    // click + three times — should cap at 2 (owned)
    await user.click(plusBtn);
    await user.click(plusBtn);
    await user.click(plusBtn);
    expect(readout!.textContent?.trim()).toBe("2");
  });

  it("open all hands every pack over", async () => {
    const onopenall = vi.fn();
    const { container } = render(BoosterInventoryDialog, {
      boosters: { a: 2, b: 1 },
      setNameOf: (id: string) => id,
      onopenall,
    });
    const btn = container.querySelector(
      '[data-cy="story-shop-open-all"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(false);
    await userEvent.setup().click(btn);
    expect(onopenall).toHaveBeenCalledOnce();
    const [picks] = onopenall.mock.calls[0] as [
      { setId: string; count: number }[],
    ];
    expect(picks).toHaveLength(2);
    const byId = Object.fromEntries(picks.map((p) => [p.setId, p.count]));
    expect(byId["a"]).toBe(2);
    expect(byId["b"]).toBe(1);
  });

  it("open selected is enabled with selection and hands picks to onopen", async () => {
    const user = userEvent.setup();
    const onopen = vi.fn();
    const { container } = render(BoosterInventoryDialog, {
      boosters: { lob: 3 },
      setNameOf: (id: string) => id,
      onopen,
    });

    const openSelectedBtn = container.querySelector(
      '[data-cy="story-shop-open-selected"]',
    ) as HTMLButtonElement;
    expect(openSelectedBtn.disabled).toBe(true);

    const plusBtn = container.querySelector(
      '[data-cy="story-shop-booster-plus-lob"]',
    ) as HTMLButtonElement;
    await user.click(plusBtn);
    await user.click(plusBtn);
    expect(openSelectedBtn.disabled).toBe(false);

    await user.click(openSelectedBtn);
    expect(onopen).toHaveBeenCalledOnce();
    const [picks] = onopen.mock.calls[0] as [
      { setId: string; count: number }[],
    ];
    expect(picks).toHaveLength(1);
    expect(picks[0]).toMatchObject({ setId: "lob", count: 2 });
  });

  it("results list opened cards with halos", async () => {
    const oncontinue = vi.fn();
    const fakeCards = Array.from({ length: 5 }, (_, i) => ({
      code: 100 + i,
      name: `Card ${i}`,
      imageUrl: null,
      rarity: "common" as const,
    }));
    const { container } = render(BoosterResultsScreen, {
      cards: fakeCards,
      oncontinue,
    });
    for (let i = 0; i < 5; i++) {
      const tile = container.querySelector(
        `[data-cy="story-shop-result-tile-${100 + i}"]`,
      ) as HTMLElement;
      expect(tile).not.toBeNull();
      expect(tile.dataset["rarity"]).toBe("common");
    }
    const continueBtn = container.querySelector(
      '[data-cy="story-shop-results-continue"]',
    ) as HTMLButtonElement;
    expect(continueBtn).not.toBeNull();
    await userEvent.setup().click(continueBtn);
    expect(oncontinue).toHaveBeenCalledOnce();
  });
});
