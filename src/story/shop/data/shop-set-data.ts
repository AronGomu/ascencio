import type { ShopRarity } from "../../model/story-state.ts";
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

export const SHOP_SET_DATA_URL = "/story/shop-sets.v1.json";
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

const RARITY_RANK: Record<ShopRarity, number> = {
  common: 0,
  rare: 1,
  "super-rare": 2,
  "ultra-rare": 3,
  "secret-rare": 4,
  "ultimate-rare": 5,
  "ghost-rare": 6,
};

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
          if (best === null || RARITY_RANK[card.rarity] > RARITY_RANK[best]) {
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
