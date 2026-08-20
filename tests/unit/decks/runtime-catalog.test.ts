import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CATALOG_SHARD_COUNT,
  catalogShardName,
  createFetchShardReader,
  loadRuntimeCatalog,
  runtimeCatalog,
  setRuntimeCatalogForTests,
  type CatalogShardReader,
} from "../../../src/decks/catalog/runtime-catalog.ts";
import {
  PROTOTYPE_CATALOG,
  PROTOTYPE_CATALOG_ASSETS,
  PROTOTYPE_CATALOG_TEXTS,
} from "../../../src/deck-editor/fixtures/catalog.ts";

/* The runtime shards are bucketed by `code % 64`, so a reader standing in for
   them buckets the same way. A loader that asked for the wrong shard would
   still build a catalog against a reader that answered every path with every
   card, and the test would pass while production returned nothing. */
function shardRows(relativePath: string): unknown[] {
  const shard = relativePath.slice(-7, -5);
  const inShard = ({ code }: { code: number }) =>
    catalogShardName(code % CATALOG_SHARD_COUNT) === shard;
  return relativePath.includes("/texts/")
    ? PROTOTYPE_CATALOG_TEXTS.filter(inShard)
    : PROTOTYPE_CATALOG_ASSETS.filter(inShard);
}

interface RecordingReader extends CatalogShardReader {
  readonly paths: readonly string[];
}

function recordingReader(
  failOn?: string,
  onRead?: () => void,
): RecordingReader {
  const paths: string[] = [];
  return {
    paths,
    readJson<T>(relativePath: string): Promise<T> {
      paths.push(relativePath);
      onRead?.();
      if (relativePath === failOn)
        return Promise.reject(new Error(`unreadable: ${relativePath}`));
      return Promise.resolve(shardRows(relativePath) as T);
    },
  };
}

function shardPaths(): readonly string[] {
  return Array.from({ length: CATALOG_SHARD_COUNT }, (_, shard) => [
    `assets/current/catalog/cards/${catalogShardName(shard)}.json`,
    `assets/current/catalog/texts/en/${catalogShardName(shard)}.json`,
  ]).flat();
}

afterEach(() => {
  setRuntimeCatalogForTests(null);
  vi.unstubAllGlobals();
});

describe("catalogShardName", () => {
  it("names shards as lowercase two-digit hex", () => {
    expect(catalogShardName(0)).toBe("00");
    expect(catalogShardName(7)).toBe("07");
    expect(catalogShardName(CATALOG_SHARD_COUNT - 1)).toBe("3f");
  });
});

describe("loadRuntimeCatalog", () => {
  it("reads all sixty-four card and text shards", async () => {
    const reader = recordingReader();
    await loadRuntimeCatalog(reader, "/");
    expect(reader.paths).toHaveLength(2 * CATALOG_SHARD_COUNT);
    expect([...reader.paths].sort()).toEqual([...shardPaths()].sort());
  });

  it("gives every card a conventional image url", async () => {
    const cards = await loadRuntimeCatalog(recordingReader(), "/app/");
    expect(cards).toHaveLength(PROTOTYPE_CATALOG_ASSETS.length);
    for (const card of cards)
      expect(card.imageUrl).toBe(`/app/runtime/images/${card.code}.jpg`);
  });

  it("rejects with the name of the shard that failed", async () => {
    const reader = recordingReader("assets/current/catalog/cards/07.json");
    await expect(loadRuntimeCatalog(reader, "/")).rejects.toThrow(
      "assets/current/catalog/cards/07.json",
    );
  });
});

describe("createFetchShardReader", () => {
  it("reads a shard from below the runtime asset root", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(shardRows(url)), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const rows = await createFetchShardReader("/app/").readJson(
      "assets/current/catalog/cards/00.json",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/app/runtime/assets/current/catalog/cards/00.json",
    );
    expect(rows).toEqual(shardRows("assets/current/catalog/cards/00.json"));
  });

  it("names the shard when the response is not ok", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("", { status: 404 })),
    );
    await expect(
      createFetchShardReader("/").readJson(
        "assets/current/catalog/cards/07.json",
      ),
    ).rejects.toThrow(
      "Runtime catalog shard failed: assets/current/catalog/cards/07.json",
    );
  });
});

describe("runtimeCatalog", () => {
  it("loads the catalog once per page", async () => {
    let reads = 0;
    vi.stubGlobal("fetch", (url: string) => {
      reads += 1;
      return Promise.resolve(
        new Response(JSON.stringify(shardRows(url)), { status: 200 }),
      );
    });
    const [first, second] = await Promise.all([
      runtimeCatalog(),
      runtimeCatalog(),
    ]);
    expect(reads).toBe(2 * CATALOG_SHARD_COUNT);
    expect(second).toBe(first);
    expect(await runtimeCatalog()).toBe(first);
    expect(reads).toBe(2 * CATALOG_SHARD_COUNT);
  });

  it("serves the fixture a test installed instead of fetching", async () => {
    setRuntimeCatalogForTests(PROTOTYPE_CATALOG);
    vi.stubGlobal("fetch", () => {
      throw new Error("a test seam must not reach the network");
    });
    await expect(runtimeCatalog()).resolves.toBe(PROTOTYPE_CATALOG);
  });
});
