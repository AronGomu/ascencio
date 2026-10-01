import { validRequirements } from "../progress.ts";
import {
  COMMERCE_RARITIES,
  type CommerceContent,
  type CanonicalSet,
} from "./content.ts";
export function exact(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join() === [...keys].sort().join()
  );
}
export function reference(value: unknown): value is string {
  return (
    typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
  );
}
function text(value: unknown, empty = false): value is string {
  return (
    typeof value === "string" &&
    (empty || value.trim().length > 0) &&
    value.length <= 512 &&
    ![...value].some((character) => character.charCodeAt(0) < 32)
  );
}
export function integer(
  value: unknown,
  min = 0,
  max = 1_000_000_000,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
function list(value: unknown, max = 10000): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    Object.keys(value).length === value.length
  );
}
function unique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}
export function validCanonicalSet(value: unknown): value is CanonicalSet {
  if (
    !exact(value, ["id", "name", "releaseYear", "imageAssetPath", "cards"]) ||
    !reference(value.id) ||
    !text(value.name) ||
    !(value.releaseYear === null || integer(value.releaseYear, 1, 9999)) ||
    !(
      value.imageAssetPath === null ||
      (typeof value.imageAssetPath === "string" &&
        /^sets\/[A-Za-z0-9_-]+\.(jpg|png|webp|svg)$/.test(value.imageAssetPath))
    ) ||
    !list(value.cards, 100000)
  )
    return false;
  const seen = new Set<string>();
  for (const card of value.cards) {
    if (
      !exact(card, [
        "cardCode",
        "printingCode",
        "rarity",
        "sourceRarity",
        "sourceRarityCode",
      ]) ||
      !integer(card.cardCode, 1, 4294967295) ||
      !text(card.printingCode) ||
      !COMMERCE_RARITIES.includes(card.rarity as never) ||
      !text(card.sourceRarity) ||
      !text(card.sourceRarityCode, true)
    )
      return false;
    const key = JSON.stringify([
      card.cardCode,
      card.printingCode,
      card.sourceRarity,
      card.sourceRarityCode,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}
/** Shape validation allows references supplied by another declared package. */
export function validateCommerce(
  value: unknown,
  setIds?: ReadonlySet<string>,
  references = true,
): value is CommerceContent {
  if (
    !exact(value, ["schemaVersion", "economies", "boosters", "shops"]) ||
    value.schemaVersion !== 1 ||
    !list(value.economies) ||
    !list(value.boosters) ||
    !list(value.shops)
  )
    return false;
  for (const economy of value.economies) {
    if (
      !exact(economy, [
        "id",
        "sellPrices",
        "singlesMultiplier",
        "maxPackResale",
      ]) ||
      !reference(economy.id) ||
      !exact(economy.sellPrices, COMMERCE_RARITIES) ||
      !Object.values(economy.sellPrices).every((v) => integer(v)) ||
      !integer(economy.singlesMultiplier, 1, 1000) ||
      !integer(economy.maxPackResale)
    )
      return false;
  }
  for (const booster of value.boosters) {
    if (
      !exact(booster, ["id", "name", "setId", "replacement", "slots"]) ||
      !reference(booster.id) ||
      !text(booster.name) ||
      !reference(booster.setId) ||
      booster.replacement !== "with" ||
      !list(booster.slots, 100) ||
      !booster.slots.length ||
      (setIds !== undefined && !setIds.has(booster.setId))
    )
      return false;
    let count = 0;
    for (const slot of booster.slots) {
      if (
        !exact(slot, ["count", "rarities", "fallback"]) ||
        !integer(slot.count, 1, 100) ||
        slot.fallback !== "all" ||
        !list(slot.rarities, 7) ||
        !slot.rarities.length
      )
        return false;
      const rarities: unknown[] = [];
      for (const weighted of slot.rarities) {
        if (
          !exact(weighted, ["rarity", "weight"]) ||
          !COMMERCE_RARITIES.includes(weighted.rarity as never) ||
          !integer(weighted.weight, 1, 1000000)
        )
          return false;
        rarities.push(weighted.rarity);
      }
      if (!unique(rarities)) return false;
      count += slot.count;
    }
    if (count > 100) return false;
  }
  for (const shop of value.shops) {
    if (
      !exact(shop, ["id", "economyId", "offers", "singles"]) ||
      !reference(shop.id) ||
      !reference(shop.economyId) ||
      typeof shop.singles !== "boolean" ||
      !list(shop.offers)
    )
      return false;
    const ids: unknown[] = [];
    for (const offer of shop.offers) {
      if (
        !exact(offer, [
          "boosterId",
          "priceDp",
          "enabled",
          "requiresProgress",
        ]) ||
        !reference(offer.boosterId) ||
        !integer(offer.priceDp) ||
        typeof offer.enabled !== "boolean" ||
        !validRequirements(offer.requiresProgress)
      )
        return false;
      ids.push(offer.boosterId);
    }
    if (!unique(ids)) return false;
  }
  const content = value as unknown as CommerceContent;
  for (const kind of ["economies", "boosters", "shops"] as const)
    if (!unique(content[kind].map((v) => v.id))) return false;
  return (
    !references ||
    content.shops.every(
      (shop) =>
        content.economies.some((e) => e.id === shop.economyId) &&
        shop.offers.every((offer) =>
          content.boosters.some((b) => b.id === offer.boosterId),
        ),
    )
  );
}
export function mergeCommerce(
  values: readonly CommerceContent[],
): CommerceContent {
  const result: CommerceContent = {
    schemaVersion: 1,
    economies: values.flatMap((v) => v.economies),
    boosters: values.flatMap((v) => v.boosters),
    shops: values.flatMap((v) => v.shops),
  };
  for (const kind of ["economies", "boosters", "shops"] as const)
    if (!unique(result[kind].map((v) => v.id)))
      throw new Error("COMMERCE_IDENTITY_CONFLICT");
  if (!validateCommerce(result)) throw new Error("COMMERCE_INVALID");
  return result;
}
