import {
  progressSatisfied,
  type CampaignProgress,
  type CommerceContent,
  type EconomyPolicy,
  type BoosterProduct,
  type ProgressRequirement,
} from "../../../modules/index.ts";
import type { StorySet } from "../../ports/story-release.ts";
import type { ShopRarity } from "../../model/story-state.ts";
/* The one declaration of how the tiers rank. It lives beside the collection's
   grouping because that is what reads it most, but the ordering is the shop's
   own and there is exactly one of it — a second table here is how "rarest
   wins" comes out differently on two screens. */
import { RARITY_ORDER } from "../../collection/group-by-rarity.ts";
import type { ShopCardOffer } from "./shop-rarity.ts";
import { inferRarity } from "./shop-rarity.ts";
import type { DeckBuilderCardView } from "../../../decks/catalog/index.ts";
import { installedShopCards } from "./installed-shop-cards.ts";
import { expectedPackResale } from "./pack-generator.ts";
import { MAX_PACK_RESALE_DP, SELL_PRICE_DP } from "./shop-pricing.ts";

export interface ShopSetCard {
  readonly code: number;
  readonly name: string;
  readonly rarity: ShopRarity;
}

export interface ShopSetEntry {
  readonly sourceSetId?: string;
  readonly priceDp?: number;
  readonly booster?: BoosterProduct;
  readonly requiresProgress?: readonly ProgressRequirement[];
  readonly imageUrl?: string | null;
  readonly id: string;
  readonly name: string;
  readonly releaseYear: number;
  readonly released: boolean;
  readonly cards: readonly ShopSetCard[];
}

export interface ShopSetData {
  readonly economy?: EconomyPolicy;
  readonly singles?: boolean;
  readonly valuationSets?: readonly ShopSetEntry[];
  readonly products?: readonly BoosterProduct[];
  readonly version: 1;
  readonly sets: readonly ShopSetEntry[];
}

export function installedShopSetData(
  sets: readonly StorySet[],
  commerce?: CommerceContent,
  shopId?: string,
): ShopSetData {
  const data: ShopSetData = Object.freeze({
    version: 1 as const,
    sets: Object.freeze(
      [...new Map(sets.map((set) => [set.id, set])).values()].map((set) =>
        Object.freeze({
          id: set.id,
          name: set.name,
          releaseYear: set.releaseYear,
          released: true,
          cards: installedShopCards(set),
        }),
      ),
    ),
  });
  const shop = commerce?.shops.find((shop) => shop.id === shopId);
  if (commerce !== undefined && shop === undefined)
    throw new Error("STORY_SHOP_INVALID");
  const economy = commerce?.economies.find(
    (economy) => economy.id === shop?.economyId,
  );
  const configured: readonly ShopSetEntry[] =
    shop === undefined
      ? data.sets
      : shop.offers.map((offer) => {
          const booster = commerce!.boosters.find(
            (product) => product.id === offer.boosterId,
          )!;
          const set = data.sets.find((set) => set.id === booster.setId);
          if (!set) throw new Error("STORY_SHOP_SET_MISSING");
          return {
            ...set,
            id: booster.id,
            name: booster.name,
            sourceSetId: set.id,
            priceDp: offer.priceDp,
            released: offer.enabled,
            booster,
            requiresProgress: offer.requiresProgress,
          };
        });
  const valuation = { ...data, valuationSets: data.sets };
  return Object.freeze({
    ...valuation,
    ...(economy === undefined
      ? {}
      : { economy, singles: shop!.singles, products: commerce!.boosters }),
    sets: Object.freeze(
      configured.map((set) =>
        Object.freeze({
          ...set,
          released:
            set.released &&
            set.cards.length > 0 &&
            expectedPackResale(
              set.cards,
              ({ code }) =>
                (economy?.sellPrices ?? SELL_PRICE_DP)[
                  resolveCardRarity(code, valuation, undefined)
                ],
              set.booster,
            ) <= (economy?.maxPackResale ?? MAX_PACK_RESALE_DP),
        }),
      ),
    ),
  });
}

const SHOP_RARITIES = new Set<string>([
  "common",
  "rare",
  "super-rare",
  "ultra-rare",
  "secret-rare",
  "ultimate-rare",
  "ghost-rare",
]);

function isShopRarity(v: unknown): v is ShopRarity {
  return typeof v === "string" && SHOP_RARITIES.has(v);
}

function isShopSetCard(v: unknown): v is ShopSetCard {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.code === "number" &&
    Number.isInteger(c.code) &&
    c.code >= 0 &&
    typeof c.name === "string" &&
    isShopRarity(c.rarity)
  );
}

function isShopSetEntry(v: unknown): v is ShopSetEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    e.id.length > 0 &&
    typeof e.name === "string" &&
    typeof e.releaseYear === "number" &&
    Number.isInteger(e.releaseYear) &&
    typeof e.released === "boolean" &&
    Array.isArray(e.cards) &&
    e.cards.every(isShopSetCard)
  );
}

export function parseShopSetData(raw: unknown): ShopSetData | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;
  const d = raw as Record<string, unknown>;
  if (d.version !== 1) return null;
  if (!Array.isArray(d.sets)) return null;
  const seen = new Set<string>();
  for (const entry of d.sets) {
    if (!isShopSetEntry(entry)) return null;
    const { id } = entry as ShopSetEntry;
    if (seen.has(id)) return null;
    seen.add(id);
  }
  return { version: 1, sets: d.sets as readonly ShopSetEntry[] };
}

export function contentsOf(
  data: ShopSetData,
  setId: string,
): readonly ShopCardOffer[] {
  const product = data.products?.find((product) => product.id === setId);
  const entry =
    data.sets.find((s) => s.id === setId) ??
    (product === undefined
      ? undefined
      : data.valuationSets?.find((set) => set.id === product.setId));
  if (entry === undefined) return [];
  return entry.cards.map((c) => ({ code: c.code, rarity: c.rarity }));
}

/* The shelf's answer to "may this be bought?", resolved where the set list
   actually lives. `reduceStory` is pure and synchronous and never sees this
   document, so it takes the answer on the command — the same way
   `open-boosters` takes cards it could not have generated itself. An id the
   data does not name is not released: a pack this build cannot list is a pack
   it cannot sell. */
export function isSetReleased(
  data: ShopSetData | null,
  setId: string,
  progress: CampaignProgress = {
    schemaVersion: 1,
    completedChapterIds: [],
    facts: {},
  },
): boolean {
  const set = data?.sets.find((s) => s.id === setId);
  return (
    set?.released === true &&
    progressSatisfied(progress, set.requiresProgress ?? [])
  );
}

const rarityIndexByData = new WeakMap<
  ShopSetData,
  ReadonlyMap<number, ShopRarity>
>();

function rarityIndex(data: ShopSetData): ReadonlyMap<number, ShopRarity> {
  const cached = rarityIndexByData.get(data);
  if (cached !== undefined) return cached;

  const indexed = new Map<number, ShopRarity>();
  for (const set of data.valuationSets ?? data.sets) {
    for (const card of set.cards) {
      const best = indexed.get(card.code);
      if (
        best === undefined ||
        RARITY_ORDER.indexOf(card.rarity) > RARITY_ORDER.indexOf(best)
      ) {
        indexed.set(card.code, card.rarity);
      }
    }
  }
  rarityIndexByData.set(data, indexed);
  return indexed;
}

export function resolveCardRarity(
  code: number,
  data: ShopSetData | null,
  view: DeckBuilderCardView | undefined,
): ShopRarity {
  if (data !== null) {
    const rarity = rarityIndex(data).get(code);
    if (rarity !== undefined) return rarity;
  }
  if (view !== undefined) return inferRarity(view);
  return "common";
}
