import type { StorySet } from "../../ports/story-release.ts";
import { RARITY_ORDER } from "../../collection/group-by-rarity.ts";
import { VARIANT_PRINTINGS } from "./shop-printing-variants.ts";
import type { ShopSetCard } from "./shop-set-data.ts";

/** One pack slot per code, using the same base-printing policy as acquisition. */
export function installedShopCards(set: StorySet): readonly ShopSetCard[] {
  const byCode = new Map<number, StorySet["cards"][number]>();
  for (const card of set.cards) {
    const current = byCode.get(card.code);
    const variant = VARIANT_PRINTINGS.has(card.sourceRarity);
    const currentVariant =
      current !== undefined && VARIANT_PRINTINGS.has(current.sourceRarity);
    if (
      current === undefined ||
      (currentVariant && !variant) ||
      (currentVariant === variant &&
        RARITY_ORDER.indexOf(card.rarity) >
          RARITY_ORDER.indexOf(current.rarity))
    ) {
      byCode.set(card.code, card);
    }
  }
  return Object.freeze(
    [...byCode.values()].map(({ code, name, rarity }) =>
      Object.freeze({ code, name, rarity }),
    ),
  );
}
