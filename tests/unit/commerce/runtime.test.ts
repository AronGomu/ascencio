import { describe, expect, it, vi } from "vitest";
import { cardCode } from "../../../src/cards/index.ts";
import type { CommerceContent } from "../../../src/modules/index.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import {
  contentsOf,
  installedShopSetData,
} from "../../../src/story/shop/data/shop-set-data.ts";
import {
  generatePack,
  openBoosters,
} from "../../../src/story/shop/data/pack-generator.ts";
import { openedPackSizes } from "../../../src/story/model/opened-pack-sizes.ts";
import { parseStoredStoryEnvelope } from "../../../src/story/saves/stored-story-envelope.ts";
import { commerceFixture } from "../../fixtures/commerce.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";
const sets = [
  {
    id: "set-a",
    name: "Set A",
    releaseYear: 2002,
    cards: [
      {
        code: cardCode(1),
        name: "Common",
        rarity: "common" as const,
        printingCode: "A-1",
        sourceRarity: "Common",
        sourceRarityCode: "C",
      },
      {
        code: cardCode(2),
        name: "Rare",
        rarity: "rare" as const,
        printingCode: "A-2",
        sourceRarity: "Rare",
        sourceRarityCode: "R",
      },
    ],
  },
];
const progress = {
  schemaVersion: 1 as const,
  completedChapterIds: [],
  facts: {},
};
function modified(): CommerceContent {
  const base = commerceFixture();
  return {
    ...base,
    boosters: [3, 5].map((size) => ({
      ...base.boosters[0]!,
      id: `pack-${size}`,
      slots: [
        {
          count: size,
          rarities: [{ rarity: "common", weight: 1 }],
          fallback: "all",
        },
      ],
    })),
    shops: [
      {
        ...base.shops[0]!,
        offers: [3, 5].map((size) => ({
          boosterId: `pack-${size}`,
          priceDp: size === 3 ? 12 : 25,
          enabled: true,
          requiresProgress: [],
        })),
      },
    ],
  };
}
function context(content: CommerceContent = modified()) {
  return { data: installedShopSetData(sets, content, "shop"), progress };
}
const state = (): StoryState => ({
  ...createInitialStoryState(),
  screen: "shop-browse",
  progressExists: true,
});
describe("content-owned shop transactions", () => {
  it("retains exact base draws and balances with replacement", () => {
    const legacy = installedShopSetData(sets),
      configured = context(commerceFixture());
    const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9];
    let index = 0;
    const before = generatePack(
      contentsOf(legacy, "set-a"),
      () => values[index++]!,
    );
    index = 0;
    expect(
      generatePack(
        contentsOf(configured.data, "set-a"),
        () => values[index++]!,
        configured.data.products![0],
      ),
    ).toEqual(before);
    expect(before.map((card) => card.rarity)).toEqual([
      ...Array(8).fill("common"),
      "rare",
    ]);
    expect(
      reduceStory(
        state(),
        { type: "buy-packs", setId: "set-a", count: 2, released: false },
        undefined,
        configured,
      ),
    ).toMatchObject({ dp: 800, boosters: { "set-a": 2 } });
  });
  it("buys independent products for one set and preserves mixed grouping through save reload", () => {
    const shop = context();
    let current = state();
    for (const id of ["pack-3", "pack-5"])
      current = reduceStory(
        current,
        { type: "buy-packs", setId: id, count: 1, released: false },
        undefined,
        shop,
      );
    expect(current).toMatchObject({
      dp: 963,
      boosters: { "pack-3": 1, "pack-5": 1 },
    });
    expect(shop.data.sets.map((set) => set.sourceSetId)).toEqual([
      "set-a",
      "set-a",
    ]);
    const picks = [
      { setId: "pack-3", count: 1 },
      { setId: "pack-5", count: 1 },
    ];
    const cards = openBoosters(
      picks,
      (id) => contentsOf(shop.data, id),
      () => 0,
      (id) => shop.data.products!.find((p) => p.id === id),
    );
    current = reduceStory(
      current,
      { type: "open-boosters", picks, cards, mode: "sequential" },
      undefined,
      shop,
    );
    expect(current).toMatchObject({
      boosters: {},
      collection: { 1: 8 },
      openedPackSizes: [3, 5],
    });
    const raw = JSON.parse(
      JSON.stringify({
        schemaVersion: 6,
        slot: "manual:1",
        revision: 1,
        savedAt: 1,
        state: current,
        story: storyBindingFixture(),
      }),
    );
    const read = parseStoredStoryEnvelope("manual:1", raw);
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") throw new Error("save rejected");
    expect(
      openedPackSizes(
        read.envelope.state.openedCards!,
        read.envelope.state.openedPackSizes,
      ),
    ).toEqual([3, 5]);
    raw.state.openedPackSizes = [4, 5];
    expect(parseStoredStoryEnvelope("manual:1", raw).kind).toBe("corrupt");
    delete raw.state.openedPackSizes;
    expect(parseStoredStoryEnvelope("manual:1", raw).kind).toBe("ready");
    expect(openedPackSizes(Array(18))).toEqual([9, 9]);
  });
  it("opens owned installed products after offer removal, preserving unknown products", () => {
    const content = modified();
    const shop = context({
      ...content,
      shops: [{ ...content.shops[0]!, offers: [] }],
    });
    const initial = { ...state(), boosters: { "pack-3": 1, removed: 2 } };
    const cards = openBoosters(
      [{ setId: "pack-3", count: 1 }],
      (id) => contentsOf(shop.data, id),
      () => 0,
      (id) => shop.data.products!.find((p) => p.id === id),
    );
    expect(
      reduceStory(
        initial,
        {
          type: "open-boosters",
          picks: [{ setId: "pack-3", count: 1 }],
          cards,
          mode: "all",
        },
        undefined,
        shop,
      ),
    ).toMatchObject({ boosters: { removed: 2 }, collection: { 1: 3 } });
    expect(
      reduceStory(
        initial,
        {
          type: "open-boosters",
          picks: [{ setId: "removed", count: 1 }],
          cards: [],
          mode: "all",
        },
        undefined,
        shop,
      ),
    ).toBe(initial);
  });
  it("resolves singles and resale values from content instead of claimed rarity", () => {
    const custom = modified();
    const shop = context({
      ...custom,
      economies: [
        {
          ...custom.economies[0]!,
          sellPrices: {
            ...custom.economies[0]!.sellPrices,
            common: 7,
            rare: 11,
          },
          singlesMultiplier: 3,
          maxPackResale: 1000,
        },
      ],
    });
    const cards = {
      ...state(),
      screen: "shop-cards" as const,
      shopSetId: "pack-3",
    };
    expect(
      reduceStory(
        cards,
        { type: "buy-single", code: 2, rarity: "common" },
        undefined,
        shop,
      ),
    ).toMatchObject({ dp: 967, collection: { 2: 1 } });
    const selling = {
      ...state(),
      screen: "shop-sell" as const,
      collection: { 1: 1 },
    };
    expect(
      reduceStory(
        selling,
        {
          type: "sell-cards",
          items: [{ code: 1, quantity: 1, rarity: "ghost-rare" }],
        },
        undefined,
        shop,
      ),
    ).toMatchObject({ dp: 1007, collection: {} });
    const content = modified(),
      disabled = context({
        ...content,
        shops: [{ ...content.shops[0]!, singles: false }],
      });
    expect(
      reduceStory(
        cards,
        { type: "buy-single", code: 2, rarity: "common" },
        undefined,
        disabled,
      ),
    ).toBe(cards);
  });
  it("enforces progress, safe integer bounds and free offers", () => {
    const content = modified();
    const offer = content.shops[0]!.offers[0]!;
    const free = context({
      ...content,
      shops: [{ ...content.shops[0]!, offers: [{ ...offer, priceDp: 0 }] }],
    });
    const initial = state();
    expect(
      reduceStory(
        initial,
        { type: "buy-packs", setId: "pack-3", count: 2, released: true },
        undefined,
        free,
      ),
    ).toMatchObject({ dp: 1000, boosters: { "pack-3": 2 } });
    const full = {
      ...initial,
      boosters: { "pack-3": Number.MAX_SAFE_INTEGER },
    };
    expect(
      reduceStory(
        full,
        { type: "buy-packs", setId: "pack-3", count: 1, released: true },
        undefined,
        free,
      ),
    ).toBe(full);
    const locked = context({
      ...content,
      shops: [
        {
          ...content.shops[0]!,
          offers: [
            {
              ...offer,
              requiresProgress: [
                { kind: "fact", id: "story:ready", equals: true },
              ],
            },
          ],
        },
      ],
    });
    expect(
      reduceStory(
        initial,
        { type: "buy-packs", setId: "pack-3", count: 1, released: true },
        undefined,
        locked,
      ),
    ).toBe(initial);
    expect(
      reduceStory(
        initial,
        {
          type: "buy-packs",
          setId: "pack-3",
          count: Number.MAX_SAFE_INTEGER,
          released: true,
        },
        undefined,
        context(),
      ),
    ).toBe(initial);
  });
  it("bounds aggregate work before drawing and preserves overflowing collections", () => {
    const shop = context(),
      random = vi.fn(() => 0);
    expect(
      openBoosters(
        [
          { setId: "pack-3", count: 1000 },
          { setId: "pack-5", count: 1 },
        ],
        (id) => contentsOf(shop.data, id),
        random,
        (id) => shop.data.products!.find((p) => p.id === id),
      ),
    ).toEqual([]);
    expect(random).not.toHaveBeenCalled();
    const full = {
      ...state(),
      boosters: { "pack-3": 1 },
      collection: { 1: Number.MAX_SAFE_INTEGER },
    };
    expect(
      reduceStory(
        full,
        {
          type: "open-boosters",
          picks: [{ setId: "pack-3", count: 1 }],
          cards: Array.from({ length: 3 }, () => ({
            code: 1,
            rarity: "common" as const,
          })),
          mode: "all",
        },
        undefined,
        shop,
      ),
    ).toBe(full);
  });
  it("uses explicit per-card weights and whole-pool fallback", () => {
    const shop = context(),
      product = {
        ...shop.data.products![0]!,
        slots: [
          {
            count: 1,
            rarities: [
              { rarity: "common" as const, weight: 1 },
              { rarity: "rare" as const, weight: 3 },
            ],
            fallback: "all" as const,
          },
        ],
      };
    expect(
      generatePack(contentsOf(shop.data, "pack-3"), () => 0.3, product)[0]!
        .code,
    ).toBe(2);
    expect(
      generatePack(contentsOf(shop.data, "pack-3"), () => 0.3, {
        ...product,
        slots: [
          {
            count: 1,
            rarities: [{ rarity: "ghost-rare", weight: 1 }],
            fallback: "all",
          },
        ],
      })[0]!.code,
    ).toBe(1);
  });
});
