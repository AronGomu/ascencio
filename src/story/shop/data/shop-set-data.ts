import type { ShopRarity } from "../../model/story-state.ts";
/* The one declaration of how the tiers rank. It lives beside the collection's
   grouping because that is what reads it most, but the ordering is the shop's
   own and there is exactly one of it — a second table here is how "rarest
   wins" comes out differently on two screens. */
import { RARITY_ORDER } from "../../collection/group-by-rarity.ts";
import type { ShopCardOffer } from "./shop-rarity.ts";
import { inferRarity } from "./shop-rarity.ts";
import type { DeckBuilderCardView } from "../../../decks/catalog/ocg-card-mapper.ts";

export interface ShopSetCard {
  readonly code: number;
  readonly name: string;
  readonly rarity: ShopRarity;
}

export interface ShopSetEntry {
  readonly id: string;
  readonly name: string;
  readonly releaseYear: number;
  readonly released: boolean;
  readonly cards: readonly ShopSetCard[];
}

export interface ShopSetData {
  readonly version: 1;
  readonly sets: readonly ShopSetEntry[];
}

/* Built from the deployed base path rather than the site root: the PWA and
   the Playwright preview both serve the bundle under a base, where a
   leading-slash literal fetches a document that is not there. `BASE_URL`
   always ends with a slash. */
export const SHOP_SET_DATA_URL = `${import.meta.env.BASE_URL}story/shop-sets.v1.json`;
export const SHOP_SET_DATA_CACHE = "story-shop-data";

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
  const entry = data.sets.find((s) => s.id === setId);
  if (entry === undefined) return [];
  return entry.cards.map((c) => ({ code: c.code, rarity: c.rarity }));
}

export function resolveCardRarity(
  code: number,
  data: ShopSetData | null,
  view: DeckBuilderCardView | undefined,
): ShopRarity {
  if (data !== null) {
    let best: ShopRarity | null = null;
    for (const set of data.sets) {
      for (const card of set.cards) {
        if (card.code === code) {
          if (
            best === null ||
            RARITY_ORDER.indexOf(card.rarity) > RARITY_ORDER.indexOf(best)
          ) {
            best = card.rarity;
          }
        }
      }
    }
    if (best !== null) return best;
  }
  if (view !== undefined) return inferRarity(view);
  return "common";
}

export async function fetchShopSetData(
  fetchFn: typeof fetch = fetch,
  cachesRef: CacheStorage = caches,
): Promise<ShopSetData> {
  const cache = await cachesRef.open(SHOP_SET_DATA_CACHE);

  const cached = await cache.match(SHOP_SET_DATA_URL);
  if (cached !== undefined) {
    let raw: unknown;
    try {
      raw = await cached.json();
    } catch {
      throw new Error("Shop data unavailable");
    }
    const parsed = parseShopSetData(raw);
    if (parsed === null) throw new Error("Shop data unavailable");
    return parsed;
  }

  let response: Response;
  try {
    response = await fetchFn(SHOP_SET_DATA_URL);
  } catch {
    throw new Error("Shop data unavailable");
  }
  if (!response.ok) throw new Error("Shop data unavailable");

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error("Shop data unavailable");
  }

  const parsed = parseShopSetData(raw);
  if (parsed === null) throw new Error("Shop data unavailable");

  await cache.put(
    SHOP_SET_DATA_URL,
    new Response(JSON.stringify(raw), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  return parsed;
}
