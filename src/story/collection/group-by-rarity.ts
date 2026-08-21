import type { ShopRarity } from "../model/story-state.ts";

/** Every rarity a card can carry, from the most common to the rarest.

    The order is the shop's own ranking, so a collection heading, a set list and
    a pack reveal all read the tiers in the same direction. Declared as the
    single source of that order rather than derived from the union: a union has
    no order, and two screens each guessing one is how a "rarest first" sort
    comes out different in two places. */
export const RARITY_ORDER: readonly ShopRarity[] = Object.freeze([
  "common",
  "rare",
  "super-rare",
  "ultra-rare",
  "secret-rare",
  "ultimate-rare",
  "ghost-rare",
]);

/** Which end of `RARITY_ORDER` the first group comes from. */
export type RarityDirection = "common-first" | "rarest-first";

export interface RarityGroup<T> {
  readonly rarity: ShopRarity;
  /** Alphabetical by name, so a group reads as a list rather than as whatever
      order the catalog happened to be shard-ordered in. */
  readonly cards: readonly T[];
}

/**
 * Buckets `cards` by rarity and orders the buckets.
 *
 * A rarity nothing in `cards` carries produces no group at all: an empty
 * "Ghost Rare" heading over nothing is a promise the collection has not kept.
 *
 * Pure, and it never touches the array handed in — the caller keeps whatever
 * order it holds, which is what lets the ungrouped view sort the same input
 * differently without a second copy of the source list.
 */
export function groupByRarity<
  T extends { readonly name: string; readonly rarity: ShopRarity },
>(cards: readonly T[], direction: RarityDirection): readonly RarityGroup<T>[] {
  const buckets = new Map<ShopRarity, T[]>();
  for (const card of cards) {
    const bucket = buckets.get(card.rarity);
    if (bucket === undefined) buckets.set(card.rarity, [card]);
    else bucket.push(card);
  }
  const order =
    direction === "common-first" ? RARITY_ORDER : [...RARITY_ORDER].reverse();
  const groups: RarityGroup<T>[] = [];
  for (const rarity of order) {
    const bucket = buckets.get(rarity);
    if (bucket === undefined) continue;
    groups.push(
      Object.freeze({
        rarity,
        cards: Object.freeze(bucket.sort(byName)),
      }),
    );
  }
  return Object.freeze(groups);
}

/** The alphabetical order both the grouped and the ungrouped views read in. */
export function byName(
  left: { readonly name: string },
  right: { readonly name: string },
): number {
  return left.name.localeCompare(right.name);
}
