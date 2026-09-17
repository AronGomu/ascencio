// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShopCardListScreen from "../../../src/story/shop/ShopCardListScreen.svelte";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";
import type { CardImageSource } from "../../../src/cards/images/index.ts";
import { readFileSync } from "node:fs";
import { parsePreparedPlayerMetadata } from "../../../scripts/lib/asset-delivery/prepared-player-metadata.ts";

afterEach(() => cleanup());

type CardEntry = {
  key: string;
  code: number;
  name: string;
  description: string;
  imageUrl: string | null;
  rarity: ShopRarity;
  priceDp: number;
};

const FIVE_CARDS: readonly CardEntry[] = [
  {
    key: "111",
    code: 111,
    name: "Blue-Eyes White Dragon",
    description: "This legendary dragon is a powerful engine of destruction.",
    imageUrl: "/art/111.jpg",
    rarity: "common",
    priceDp: 40,
  },
  {
    key: "222",
    code: 222,
    name: "Dark Magician",
    description: "The ultimate wizard in terms of attack and defense.",
    imageUrl: null,
    rarity: "rare",
    priceDp: 100,
  },
  {
    key: "333",
    code: 333,
    name: "Exodia the Forbidden One",
    description:
      "Cannot be Normal Summoned or Set. Must first be Special Summoned.",
    imageUrl: "/art/333.jpg",
    rarity: "ultra-rare",
    priceDp: 400,
  },
  {
    key: "444",
    code: 444,
    name: "Summoned Skull",
    description: "A fiend with dark powers for confusing the enemy.",
    imageUrl: "/art/444.jpg",
    rarity: "super-rare",
    priceDp: 200,
  },
  {
    key: "555",
    code: 555,
    name: "Red-Eyes Black Dragon",
    description: "A ferocious dragon with a deadly attack.",
    imageUrl: "/art/555.jpg",
    rarity: "secret-rare",
    priceDp: 1000,
  },
];

const noop = () => undefined;
const previewImages: CardImageSource = {
  acquire: async (code) => ({
    url: `/art/${code}.jpg`,
    release: noop,
  }),
};

describe("ShopCardListScreen", () => {
  it("canonical regional printings retain unique tiles and purchase identity", async () => {
    const metadata = parsePreparedPlayerMetadata(
      JSON.parse(
        readFileSync("generated/asset-delivery/prepared-player.json", "utf8"),
      ),
    );
    const set = metadata.chapters[0]!.gameplay.sets.find(
      ({ id }) => id === "metal-raiders",
    )!;
    const printings = set.cards.filter(
      ({ code }) => code === 62121 || code === 5818798,
    );
    expect(
      printings
        .filter(({ code }) => code === 62121)
        .map(({ printingCode }) => printingCode),
    ).toEqual(["MRD-073", "MRD-E073", "MRD-EN073"]);
    const onbuysingle = vi.fn();
    const cards = printings.map((card) => ({
      ...card,
      key: JSON.stringify([
        card.code,
        card.printingCode,
        card.sourceRarity,
        card.sourceRarityCode,
      ]),
      description: "",
      imageUrl: null,
      priceDp: 40,
    }));
    const { container } = render(ShopCardListScreen, {
      cards,
      dp: 40,
      onbuysingle,
    });
    const ids = [...container.querySelectorAll("[data-cy]")].map((element) =>
      element.getAttribute("data-cy"),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      container.querySelectorAll('[data-cy^="story-shop-card-buy-"]'),
    ).toHaveLength(7);
    for (const card of cards) {
      const button = container.querySelector(
        `[data-cy="story-shop-card-buy-${encodeURIComponent(card.key)}"]`,
      ) as HTMLButtonElement;
      expect(button.textContent?.trim()).toBe("40 DP");
      expect(button.disabled).toBe(false);
      await userEvent.setup().click(button);
      expect(onbuysingle).toHaveBeenLastCalledWith(card.code, card.rarity);
    }
    expect(onbuysingle).toHaveBeenCalledTimes(7);
  });
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
          '[data-cy="story-shop-card-preview-name"]',
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

  /* The owner's ask: the same preview the duel and the deck editor dock, so a
     player deciding what to buy reads the card's effect text before they spend
     on it. A story-local name-and-art tile could never answer that. */
  it("the preview is the shared panel, effect text and all", async () => {
    const { container } = render(ShopCardListScreen, {
      setName: "LOB",
      dp: 9999,
      cards: FIVE_CARDS,
      imageSource: previewImages,
      onbuysingle: noop,
      onback: noop,
    });
    const preview = container.querySelector(
      '[data-cy="story-shop-cards-preview"]',
    ) as HTMLElement;
    expect(
      preview.querySelector('[data-cy="story-shop-card-preview-panel"]'),
      "the shared preview panel is mounted in the set list",
    ).not.toBeNull();

    await fireEvent.mouseEnter(
      container.querySelector('[data-cy="story-shop-card-444"]')!,
    );
    expect(
      preview.querySelector('[data-cy="story-shop-card-preview-text"]')
        ?.textContent,
    ).toContain("A fiend with dark powers");
    await vi.waitFor(() =>
      expect(
        preview
          .querySelector('[data-cy="story-shop-card-preview-image"]')
          ?.getAttribute("src"),
      ).toBe("/art/444.jpg"),
    );

    /* One rendering of the card, not two: the panel draws the art, so the
       screen's own tile is gone from the preview column. */
    expect(
      preview.querySelector('[data-cy="story-shop-cards-preview-art-444"]'),
    ).toBeNull();
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
