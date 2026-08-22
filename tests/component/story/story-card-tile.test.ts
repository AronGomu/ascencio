// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import CollectionScreen from "../../../src/story/collection/CollectionScreen.svelte";
import StoryCardTile from "../../../src/story/components/StoryCardTile.svelte";
import BoosterOpeningScreen from "../../../src/story/shop/BoosterOpeningScreen.svelte";
import BoosterResultsScreen from "../../../src/story/shop/BoosterResultsScreen.svelte";
import ShopCardListScreen from "../../../src/story/shop/ShopCardListScreen.svelte";
import ShopSellScreen from "../../../src/story/shop/ShopSellScreen.svelte";
import { storyCardOwnership } from "../../../src/story/decks/card-ownership.ts";
import {
  createInitialStoryState,
  type ShopRarity,
} from "../../../src/story/model/story-state.ts";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";

afterEach(() => cleanup());

const noop = () => undefined;

describe("StoryCardTile", () => {
  it("renders the whole card, not a crop", () => {
    /* The fit is a style rule, and jsdom applies no stylesheet, so the rule
       itself is the evidence — the same check the deck editor's tile carries. */
    const source = readFileSync(
      "src/story/components/StoryCardTile.svelte",
      "utf8",
    );
    expect(source).toMatch(/object-fit:\s*contain/);
    expect(source).toMatch(/aspect-ratio:\s*421 \/ 614/);
    expect(source).toMatch(/width:\s*100%/);
    expect(source).not.toMatch(/object-fit:\s*cover/);
  });

  it("renders a placeholder without an image", () => {
    const { container } = render(StoryCardTile, {
      name: "Dark Magician",
      imageUrl: null,
      dataCyPrefix: "story-shop-card",
      dataCyId: 222,
    });
    expect(
      container.querySelector('[data-cy="story-shop-card-placeholder-222"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="story-shop-card-art-222"]'),
    ).toBeNull();
  });

  it("a broken image degrades to the placeholder", async () => {
    const { container } = render(StoryCardTile, {
      name: "Dark Magician",
      imageUrl: "/art/222.jpg",
      dataCyPrefix: "story-shop-card",
      dataCyId: 222,
    });
    const art = container.querySelector('[data-cy="story-shop-card-art-222"]');
    expect(art).not.toBeNull();
    await fireEvent.error(art!);
    expect(
      container.querySelector('[data-cy="story-shop-card-placeholder-222"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="story-shop-card-art-222"]'),
    ).toBeNull();
  });

  it("keeps the rarity halo hook", () => {
    const { container } = render(ShopCardListScreen, {
      setName: "LOB",
      dp: 9999,
      cards: [
        {
          code: 333,
          name: "Exodia the Forbidden One",
          imageUrl: "/art/333.jpg",
          rarity: "ultra-rare" as ShopRarity,
          priceDp: 400,
        },
      ],
      onbuysingle: noop,
      onback: noop,
    });
    const tile = container.querySelector(
      '[data-cy="story-shop-card-333"]',
    ) as HTMLElement;
    expect(tile.classList.contains("rarity-halo")).toBe(true);
    expect(tile.dataset["rarity"]).toBe("ultra-rare");
    expect(
      tile.querySelector('[data-cy="story-shop-card-art-333"]'),
    ).not.toBeNull();
  });

  it("set card list uses the shared tile", () => {
    const { container } = render(ShopCardListScreen, {
      setName: "LOB",
      dp: 9999,
      cards: [
        {
          code: 111,
          name: "Blue-Eyes White Dragon",
          imageUrl: "/art/111.jpg",
          rarity: "common" as ShopRarity,
          priceDp: 40,
        },
      ],
      onbuysingle: noop,
      onback: noop,
    });
    expect(
      container.querySelector('[data-cy="story-shop-card-art-111"]'),
    ).not.toBeNull();
    /* The preview beside the grid is the same card at a larger size, so it is
       the same tile rather than a second rendering of one. */
    expect(
      container.querySelector('[data-cy="story-shop-cards-preview-art-111"]'),
    ).not.toBeNull();
  });

  it("reveal and results screens use the shared tile", async () => {
    const cards = [
      {
        code: 111,
        name: "Blue-Eyes White Dragon",
        imageUrl: "/art/111.jpg",
        rarity: "common" as ShopRarity,
      },
    ];
    const opening = render(BoosterOpeningScreen, { cards, onfinish: noop });
    await userEvent
      .setup()
      .click(
        opening.container.querySelector(
          '[data-cy="story-shop-opening"]',
        ) as HTMLElement,
      );
    expect(
      opening.container.querySelector('[data-cy="story-shop-opening-art-0"]'),
    ).not.toBeNull();

    const results = render(BoosterResultsScreen, { cards, oncontinue: noop });
    expect(
      results.container.querySelector(
        '[data-cy="story-shop-result-art-111-0"]',
      ),
    ).not.toBeNull();
  });

  it("sell screen shows the card it is about to sell", () => {
    const { container } = render(ShopSellScreen, {
      cards: [
        {
          code: 111,
          name: "Blue-Eyes White Dragon",
          imageUrl: "/art/111.jpg",
          rarity: "common" as ShopRarity,
          owned: 3,
        },
      ],
      onsell: noop,
      onback: noop,
    });
    expect(
      container.querySelector('[data-cy="story-shop-sell-art-111"]'),
    ).not.toBeNull();
  });

  it("collection screen uses the shared tile", () => {
    const cards: readonly DeckBuilderCardView[] = [
      {
        code: 4007,
        name: "Dark Magician",
        description: "Dark Magician card text",
        family: "monster",
        subtypes: ["Normal"],
        attribute: "DARK",
        race: "Spellcaster",
        levelRankLink: 7,
        ratingLabel: "Level",
        attack: 2500,
        defense: 2100,
        pendulumScales: null,
        linkMarkers: [],
        canonicalZone: "main",
        imageUrl: "/art/4007.jpg",
        scope: 3,
        rawType: 1,
      },
    ];
    const { container } = render(CollectionScreen, {
      ownership: storyCardOwnership({
        ...createInitialStoryState(),
        collection: { 4007: 2 },
      }),
      cards,
      rarityByCode: new Map<number, ShopRarity>([[4007, "ultra-rare"]]),
      onback: noop,
    });
    expect(
      container.querySelector('[data-cy="collection-art-4007"]'),
    ).not.toBeNull();
  });
});
