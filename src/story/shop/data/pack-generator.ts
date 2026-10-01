import type { OpenedCard } from "../../model/story-state.ts";
import type { BoosterProduct } from "../../../modules/index.ts";
import type { ShopCardOffer } from "./shop-rarity.ts";
import { PACK_SIZE } from "./shop-pricing.ts";
function pools(contents: readonly ShopCardOffer[], product?: BoosterProduct) {
  if (product !== undefined)
    return product.slots.map((slot) => {
      const weighted = contents.flatMap((card) => {
        const weight = slot.rarities.find(
          (r) => r.rarity === card.rarity,
        )?.weight;
        return weight === undefined ? [] : [{ card, weight }];
      });
      return {
        count: slot.count,
        cards: weighted.length
          ? weighted
          : contents.map((card) => ({ card, weight: 1 })),
      };
    });
  const commons = contents.filter((c) => c.rarity === "common"),
    rare = contents.filter((c) => c.rarity !== "common");
  return [
    {
      count: PACK_SIZE - 1,
      cards: (commons.length ? commons : contents).map((card) => ({
        card,
        weight: 1,
      })),
    },
    {
      count: 1,
      cards: (rare.length ? rare : contents).map((card) => ({
        card,
        weight: 1,
      })),
    },
  ];
}
export function boosterSize(product?: BoosterProduct): number {
  return product?.slots.reduce((sum, slot) => sum + slot.count, 0) ?? PACK_SIZE;
}
export function expectedPackResale(
  contents: readonly ShopCardOffer[],
  sellPrice: (card: ShopCardOffer) => number,
  product?: BoosterProduct,
): number {
  if (!contents.length) return 0;
  return pools(contents, product).reduce(
    (total, pool) =>
      total +
      (pool.count *
        pool.cards.reduce(
          (sum, item) => sum + item.weight * sellPrice(item.card),
          0,
        )) /
        pool.cards.reduce((sum, item) => sum + item.weight, 0),
    0,
  );
}
export function generatePack(
  contents: readonly ShopCardOffer[],
  random: () => number,
  product?: BoosterProduct,
): readonly OpenedCard[] {
  if (!contents.length) return [];
  const result: OpenedCard[] = [];
  for (const pool of pools(contents, product))
    for (let index = 0; index < pool.count; index++) {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1)
        throw new Error("PACK_RANDOM_INVALID");
      let target =
        value * pool.cards.reduce((sum, item) => sum + item.weight, 0);
      const selected = pool.cards.find((item) => {
        target -= item.weight;
        return target < 0;
      })!;
      result.push({ code: selected.card.code, rarity: selected.card.rarity });
    }
  return result;
}
export function openablePicks<T extends { setId: string; count: number }>(
  picks: readonly T[],
  contentsOf: (id: string) => readonly ShopCardOffer[],
): readonly T[] {
  return picks.filter((pick) => contentsOf(pick.setId).length > 0);
}
export function openBoosters(
  picks: readonly { setId: string; count: number }[],
  contentsOf: (id: string) => readonly ShopCardOffer[],
  random: () => number,
  productOf?: (id: string) => BoosterProduct | undefined,
): readonly OpenedCard[] {
  const eligible = openablePicks(picks, contentsOf);
  if (eligible.length > 1000) return [];
  let total = 0,
    packs = 0;
  for (const { setId, count } of eligible) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 1000) return [];
    packs += count;
    total += count * boosterSize(productOf?.(setId));
    if (packs > 1000 || total > 100000) return [];
  }
  const result: OpenedCard[] = [];
  for (const { setId, count } of openablePicks(picks, contentsOf)) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 1000) return [];
    for (let index = 0; index < count; index++)
      result.push(
        ...generatePack(contentsOf(setId), random, productOf?.(setId)),
      );
  }
  return result;
}
