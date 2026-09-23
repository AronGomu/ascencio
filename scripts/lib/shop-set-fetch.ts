import { readCappedResponseBody } from "./capped-response-body.ts";
import { foldSetCards } from "./shop-set-fold.ts";
import type { CardEntry, FoldedCard } from "./shop-set-fold.ts";

export async function fetchSetCards(
  apiName: string,
  fetcher: typeof fetch = fetch,
): Promise<FoldedCard[]> {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(apiName)}`;
  const response = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching "${apiName}"`);
  }
  const body = await readCappedResponseBody(
    response,
    8 * 1024 * 1024,
    `Shop set "${apiName}"`,
  );
  if (body.status === "too-large") throw new Error(body.error);
  const json = JSON.parse(new TextDecoder().decode(body.bytes)) as {
    data: CardEntry[];
  };
  return foldSetCards(json.data, apiName);
}
