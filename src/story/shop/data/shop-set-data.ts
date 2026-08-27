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

/* The shelf's answer to "may this be bought?", resolved where the set list
   actually lives. `reduceStory` is pure and synchronous and never sees this
   document, so it takes the answer on the command — the same way
   `open-boosters` takes cards it could not have generated itself. An id the
   data does not name is not released: a pack this build cannot list is a pack
   it cannot sell. */
export function isSetReleased(
  data: ShopSetData | null,
  setId: string,
): boolean {
  return data?.sets.find((s) => s.id === setId)?.released === true;
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

/* Network-first with cache fallback: every online visit revalidates the
   shipped JSON so content edits reach returning profiles, while a failed,
   stalled or invalid fetch serves the last good cached payload — the ADR-035
   offline guarantee. The cached entry is read before the fetch because it is
   what decides the deadline: with a good copy in hand, a 3 s abort stops a
   stalled revalidation from holding the shop shut, and the fallback covers
   it. On a cold cache that half-megabyte download is the only copy there is,
   so it runs unbounded — aborting it would turn a slow-but-working link into
   a permanent "Shop data unavailable" that no retry can clear. `cache:
   "no-cache"` keeps freshness independent of host HTTP-cache headers on both
   paths. The cache entry is only replaced by a payload that parsed, so a bad
   deploy can never clobber a good cache. */
export async function fetchShopSetData(
  fetchFn: typeof fetch = fetch,
  cachesRef: CacheStorage = caches,
): Promise<ShopSetData> {
  const cache = await cachesRef.open(SHOP_SET_DATA_CACHE);
  const cached = await cache.match(SHOP_SET_DATA_URL);

  let fresh: unknown;
  try {
    const response = await fetchFn(SHOP_SET_DATA_URL, {
      cache: "no-cache",
      ...(cached !== undefined ? { signal: AbortSignal.timeout(3000) } : {}),
    });
    if (response.ok) fresh = await response.json();
  } catch {
    fresh = undefined;
  }

  if (fresh !== undefined) {
    const parsed = parseShopSetData(fresh);
    if (parsed !== null) {
      /* A refused write — quota, private mode — costs the next offline visit
         its update, not this visit its data: the parsed payload is already in
         hand, so the storage error stays out of the UI. */
      try {
        await cache.put(
          SHOP_SET_DATA_URL,
          new Response(JSON.stringify(fresh), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      } catch {
        /* previous cache entry stands */
      }
      return parsed;
    }
  }

  if (cached === undefined) throw new Error("Shop data unavailable");
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
