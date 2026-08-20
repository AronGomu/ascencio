import type {
  AssetDeckCardRecord,
  DeckBuilderCardView,
} from "./ocg-card-mapper.ts";
import { packagedCatalog, type PackagedCardText } from "./packaged-catalog.ts";

/** How a host reads one shard of the packaged catalog. */
export interface CatalogShardReader {
  readJson<T>(relativePath: string): Promise<T>;
}

/** The snapshot buckets every card by `code % 64`, one file per bucket. */
export const CATALOG_SHARD_COUNT = 64;

/** `0` → `"00"`, `63` → `"3f"` — the snapshot's own file naming. */
export function catalogShardName(shard: number): string {
  return shard.toString(16).padStart(2, "0");
}

function cardShardPath(shard: number): string {
  return `assets/current/catalog/cards/${catalogShardName(shard)}.json`;
}

function textShardPath(shard: number): string {
  return `assets/current/catalog/texts/en/${catalogShardName(shard)}.json`;
}

/* A 404, an offline network and a truncated body are one failure to a player —
   the catalog is incomplete — so all three surface as the shard's own name
   rather than as a parse error from somewhere inside a 200 kB response. The
   original stays as `cause`, because which of the three it was is exactly what
   the next person debugging this needs. */
function shardFailure(relativePath: string, cause: unknown): Error {
  return new Error(`Runtime catalog shard failed: ${relativePath}`, { cause });
}

/** Reads shards over HTTP from the runtime asset root the Worker already reads. */
export function createFetchShardReader(baseUrl: string): CatalogShardReader {
  return {
    async readJson<T>(relativePath: string): Promise<T> {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}runtime/${relativePath}`);
      } catch (error) {
        throw shardFailure(relativePath, error);
      }
      if (!response.ok)
        throw shardFailure(relativePath, new Error(`HTTP ${response.status}`));
      try {
        return (await response.json()) as T;
      } catch (error) {
        throw shardFailure(relativePath, error);
      }
    },
  };
}

/**
 * Every card the packaged database holds, joined to its text and its art.
 *
 * Art is a URL by convention for every code rather than a manifest lookup: the
 * database is ~14.8k cards and the build packages only the images it verified,
 * so absence is the normal case and a tile that 404s falls back to the
 * placeholder glyph. Deriving the URL keeps a card playable in a deck whose art
 * this build happens not to carry.
 */
export async function loadRuntimeCatalog(
  reader: CatalogShardReader,
  imageBaseUrl: string,
): Promise<readonly DeckBuilderCardView[]> {
  const shards = Array.from({ length: CATALOG_SHARD_COUNT }, (_, i) => i);
  const [cardShards, textShards] = await Promise.all([
    Promise.all(
      shards.map((shard) =>
        reader.readJson<readonly AssetDeckCardRecord[]>(cardShardPath(shard)),
      ),
    ),
    Promise.all(
      shards.map((shard) =>
        reader.readJson<readonly PackagedCardText[]>(textShardPath(shard)),
      ),
    ),
  ]);
  const cards = cardShards.flat();
  return packagedCatalog(
    cards,
    textShards.flat(),
    new Map(
      cards.map(({ code }) => [
        code,
        `${imageBaseUrl}runtime/images/${code}.jpg`,
      ]),
    ),
  );
}

let pending: Promise<readonly DeckBuilderCardView[]> | null = null;

/**
 * The catalog for this page, read at most once.
 *
 * The editor and the duel share the memo on purpose: a build that offered a
 * card in one and withheld it in the other would let a player spend an evening
 * on a deck `#/duel` then refuses. One read means one answer.
 */
export function runtimeCatalog(): Promise<readonly DeckBuilderCardView[]> {
  const base = import.meta.env.BASE_URL;
  pending ??= loadRuntimeCatalog(createFetchShardReader(base), base);
  return pending;
}

/**
 * Points `runtimeCatalog()` at a fixture, or clears it with `null`.
 *
 * jsdom has no runtime assets to serve, so a component test that mounted the
 * editor without this would hang on the loading skeleton until its timeout.
 */
export function setRuntimeCatalogForTests(
  cards: readonly DeckBuilderCardView[] | null,
): void {
  pending = cards === null ? null : Promise.resolve(cards);
}
