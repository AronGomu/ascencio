import type { ImageRecord } from "./model.ts";

interface ShopCard {
  code: number;
}

interface ShopSetJson {
  version: 1;
  sets: Array<{ cards: ShopCard[] }>;
}

/** Parse shop JSON string and return sorted unique card passcodes. */
export function collectShopCodes(shopJson: string): number[] {
  const data = JSON.parse(shopJson) as ShopSetJson;
  const seen = new Set<number>();
  for (const set of data.sets) {
    for (const card of set.cards) {
      seen.add(card.code);
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/** Build image URL record using the YGOPRODeck convention for a passcode. */
export function imageRecordFromCode(code: number): ImageRecord {
  return {
    code,
    full: `https://images.ygoprodeck.com/images/cards/${code}.jpg`,
    cropped: `https://images.ygoprodeck.com/images/cards_cropped/${code}.jpg`,
  };
}

/**
 * Union base image records with shop codes, adding URL records for any shop
 * code not already present in the base set. Returns sorted by code.
 */
export function mergeShopImageRecords(
  base: ImageRecord[],
  shopCodes: number[],
): ImageRecord[] {
  const baseSet = new Set(base.map((r) => r.code));
  const extra = shopCodes
    .filter((code) => !baseSet.has(code))
    .map((code) => imageRecordFromCode(code));
  return [...base, ...extra].sort((a, b) => a.code - b.code);
}

/** Minimal fetch-like signature accepted by {@link fetchImageCode}. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ status: number; ok: boolean }>;

export type ImageFetchResult =
  | { code: number; status: "ok" }
  | { code: number; status: "missing" }
  | { code: number; status: "failed"; error: string };

/**
 * Attempt a single HEAD-style probe for one card image URL. Returns "missing"
 * for HTTP 404; returns "failed" for other errors without throwing, so a
 * missing upstream code never aborts the pipeline.
 */
export async function fetchImageCode(
  code: number,
  url: string,
  fetchFn: FetchLike,
): Promise<ImageFetchResult> {
  try {
    const res = await fetchFn(url, {
      headers: { "user-agent": "YGO-Story-Duel-Simulator/0.1 asset importer" },
    });
    if (res.status === 404) return { code, status: "missing" };
    if (!res.ok) return { code, status: "failed", error: `HTTP ${res.status}` };
    return { code, status: "ok" };
  } catch (e) {
    return { code, status: "failed", error: (e as Error).message };
  }
}
