import { describe, expect, it } from "vitest";
import {
  buildDeckCatalogIndex,
  filterDeckCatalogIndex,
} from "../../../src/decks/catalog/deck-catalog-index.ts";
import {
  catalogFilterOptions,
  EMPTY_CATALOG_FILTERS,
} from "../../../src/decks/catalog/deck-catalog.ts";
import {
  loadRuntimeCatalog,
  CATALOG_SHARD_COUNT,
  catalogShardName,
} from "../../../src/decks/catalog/runtime-catalog.ts";
import type { CatalogShardReader } from "../../../src/decks/catalog/runtime-catalog.ts";
import type { AssetDeckCardRecord } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import type { PackagedCardText } from "../../../src/decks/catalog/packaged-catalog.ts";
import { syntheticCatalog } from "../../fixtures/synthetic-catalog.ts";

const CARDS_15K = syntheticCatalog(15_000);

/** Build an in-memory CatalogShardReader from 15k synthetic view cards. */
function makeInMemoryReader(count: number): CatalogShardReader {
  // produce raw records bucketed by code % 64
  const cardShards = new Map<string, AssetDeckCardRecord[]>();
  const textShards = new Map<string, PackagedCardText[]>();

  for (let i = 0; i < CATALOG_SHARD_COUNT; i++) {
    const key = catalogShardName(i);
    cardShards.set(`assets/current/catalog/cards/${key}.json`, []);
    textShards.set(`assets/current/catalog/texts/en/${key}.json`, []);
  }

  for (let i = 0; i < count; i++) {
    const code = 10_000_000 + i;
    const bucket = catalogShardName(code % CATALOG_SHARD_COUNT);
    const cardRecord: AssetDeckCardRecord = {
      code,
      alias: 0,
      setcodes: [],
      // spell type: 0x2 = TYPE_SPELL
      type: 0x2,
      level: 0,
      attribute: 0,
      race: "",
      attack: 0,
      defense: 0,
      lscale: 0,
      rscale: 0,
      linkMarker: 0,
      ot: 1,
    };
    const textRecord: PackagedCardText = {
      code,
      name: `Synthetic Card ${i}`,
      description: "",
    };
    cardShards
      .get(`assets/current/catalog/cards/${bucket}.json`)!
      .push(cardRecord);
    textShards
      .get(`assets/current/catalog/texts/en/${bucket}.json`)!
      .push(textRecord);
  }

  return {
    async readJson<T>(relativePath: string): Promise<T> {
      const result =
        cardShards.get(relativePath) ?? textShards.get(relativePath) ?? [];
      return result as T;
    },
  };
}

describe("catalog performance budgets", () => {
  it("building the index stays under budget", () => {
    const t0 = performance.now();
    buildDeckCatalogIndex(CARDS_15K);
    const elapsed = performance.now() - t0;
    // measured: ~18ms in Vitest (Node 24 transform overhead), budget = ~22× headroom
    expect(elapsed).toBeLessThan(400);
  });

  it("a name search stays under budget (best of 20 runs)", () => {
    const index = buildDeckCatalogIndex(CARDS_15K);
    const filters = { ...EMPTY_CATALOG_FILTERS, name: "dragon" };
    let best = Infinity;
    for (let r = 0; r < 20; r++) {
      const t0 = performance.now();
      filterDeckCatalogIndex(index, filters);
      const elapsed = performance.now() - t0;
      if (elapsed < best) best = elapsed;
    }
    // measured: ~6ms in Vitest, budget = ~6× headroom
    expect(best).toBeLessThan(40);
  });

  it("deriving filter options stays under budget", () => {
    const t0 = performance.now();
    catalogFilterOptions(CARDS_15K);
    const elapsed = performance.now() - t0;
    // measured: ~3ms in Vitest, budget = ~100× headroom
    expect(elapsed).toBeLessThan(300);
  });

  it("loading the catalog stays under budget", async () => {
    const reader = makeInMemoryReader(15_000);
    const t0 = performance.now();
    await loadRuntimeCatalog(reader, "http://localhost/");
    const elapsed = performance.now() - t0;
    // measured: ~43ms in Vitest (in-memory reader), budget = ~35× headroom
    expect(elapsed).toBeLessThan(1500);
  });
});
