import type { OpenedCard } from "../../model/story-state.ts";
import type { ShopCardOffer } from "./shop-rarity.ts";
import { PACK_SIZE } from "./shop-pricing.ts";

export function generatePack(
  contents: readonly ShopCardOffer[],
  random: () => number,
): readonly OpenedCard[] {
  /* A set with nothing in it cannot fill a pack. It is reachable from a
     tampered save and from a data file that drops a set, and reading past the
     end of an empty pool threw mid-dispatch — an uncaught exception with the
     dialog already closed. */
  if (contents.length === 0) return [];
  const commons = contents.filter((c) => c.rarity === "common");
  const rarePlus = contents.filter((c) => c.rarity !== "common");

  const commonPool = commons.length > 0 ? commons : contents;
  const rarePlusPool = rarePlus.length > 0 ? rarePlus : contents;

  const cards: OpenedCard[] = [];
  for (let i = 0; i < PACK_SIZE - 1; i++) {
    // pools are always non-empty by construction (filtered or whole contents)
    const offer = commonPool[Math.floor(random() * commonPool.length)]!;
    cards.push({ code: offer.code, rarity: offer.rarity });
  }
  const finalOffer = rarePlusPool[Math.floor(random() * rarePlusPool.length)]!;
  cards.push({ code: finalOffer.code, rarity: finalOffer.rarity });

  return cards;
}

/** The picks the loaded shop data can actually open. A pick naming a set with
    no contents opens nothing, so it is dropped here rather than consuming the
    packs it could never turn into cards. */
export function openablePicks<T extends { setId: string; count: number }>(
  picks: readonly T[],
  contentsOf: (setId: string) => readonly ShopCardOffer[],
): readonly T[] {
  return picks.filter(({ setId }) => contentsOf(setId).length > 0);
}

export function openBoosters(
  picks: readonly { setId: string; count: number }[],
  contentsOf: (setId: string) => readonly ShopCardOffer[],
  random: () => number,
): readonly OpenedCard[] {
  const all: OpenedCard[] = [];
  for (const { setId, count } of openablePicks(picks, contentsOf)) {
    const contents = contentsOf(setId);
    for (let i = 0; i < count; i++) {
      all.push(...generatePack(contents, random));
    }
  }
  return all;
}
