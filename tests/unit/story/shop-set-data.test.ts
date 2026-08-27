import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import {
  contentsOf,
  fetchShopSetData,
  parseShopSetData,
  resolveCardRarity,
  SHOP_SET_DATA_CACHE,
  SHOP_SET_DATA_URL,
  type ShopSetData,
} from "../../../src/story/shop/data/shop-set-data.ts";

const VALID_FIXTURE: ShopSetData = {
  version: 1,
  sets: [
    {
      id: "alpha",
      name: "Alpha Set",
      releaseYear: 2002,
      released: true,
      cards: [
        {
          code: 89631139,
          name: "Blue-Eyes White Dragon",
          rarity: "ultra-rare",
        },
        { code: 46986414, name: "Dark Magician", rarity: "rare" },
      ],
    },
    {
      id: "beta",
      name: "Beta Set",
      releaseYear: 2003,
      released: false,
      cards: [
        {
          code: 89631139,
          name: "Blue-Eyes White Dragon",
          rarity: "secret-rare",
        },
      ],
    },
  ],
};

const UPDATED_FIXTURE: ShopSetData = {
  version: 1,
  sets: [VALID_FIXTURE.sets[0]!, { ...VALID_FIXTURE.sets[1]!, released: true }],
};

function fakeView(
  overrides: Partial<DeckBuilderCardView> = {},
): DeckBuilderCardView {
  return {
    code: 1,
    name: "",
    description: "",
    family: "monster",
    subtypes: [],
    attribute: null,
    race: null,
    levelRankLink: null,
    ratingLabel: null,
    attack: null,
    defense: null,
    pendulumScales: null,
    linkMarkers: [],
    canonicalZone: "main",
    imageUrl: null,
    scope: 0,
    rawType: 0,
    ...overrides,
  };
}

function makeFakeCache(stored: unknown): {
  cacheStorage: CacheStorage;
  putCalls: string[];
  putBodies: string[];
} {
  const putCalls: string[] = [];
  const putBodies: string[] = [];
  const matchResult =
    stored !== null
      ? new Response(JSON.stringify(stored), {
          headers: { "Content-Type": "application/json" },
        })
      : undefined;

  const cache: Cache = {
    match: async () => matchResult,
    put: async (req: RequestInfo | URL, res: Response) => {
      putCalls.push(typeof req === "string" ? req : String(req));
      putBodies.push(await res.text());
    },
    add: async () => {},
    addAll: async () => {},
    delete: async () => false,
    keys: async () => [],
  } as unknown as Cache;

  const cacheStorage: CacheStorage = {
    open: async () => cache,
    match: async () => undefined,
    has: async () => false,
    delete: async () => false,
    keys: async () => [],
  };

  return { cacheStorage, putCalls, putBodies };
}

describe("parseShopSetData", () => {
  it("parses a valid document", () => {
    const raw: unknown = {
      version: 1,
      sets: [
        {
          id: "alpha",
          name: "Alpha Set",
          releaseYear: 2002,
          released: true,
          cards: [
            {
              code: 89631139,
              name: "Blue-Eyes White Dragon",
              rarity: "ultra-rare",
            },
          ],
        },
        {
          id: "beta",
          name: "Beta Set",
          releaseYear: 2003,
          released: false,
          cards: [{ code: 46986414, name: "Dark Magician", rarity: "common" }],
        },
      ],
    };
    const result = parseShopSetData(raw);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.sets).toHaveLength(2);
    expect(result!.sets[0]!.id).toBe("alpha");
    expect(result!.sets[1]!.id).toBe("beta");
  });

  it("rejects bad shapes", () => {
    const cases: unknown[] = [
      // missing version
      {
        sets: [
          { id: "a", name: "A", releaseYear: 2002, released: false, cards: [] },
        ],
      },
      // wrong version
      { version: 2, sets: [] },
      // rarity outside union
      {
        version: 1,
        sets: [
          {
            id: "a",
            name: "A",
            releaseYear: 2002,
            released: false,
            cards: [{ code: 1, name: "X", rarity: "mythic-rare" }],
          },
        ],
      },
      // non-integer code
      {
        version: 1,
        sets: [
          {
            id: "a",
            name: "A",
            releaseYear: 2002,
            released: false,
            cards: [{ code: 1.5, name: "X", rarity: "common" }],
          },
        ],
      },
      // duplicate set id
      {
        version: 1,
        sets: [
          {
            id: "dup",
            name: "A",
            releaseYear: 2002,
            released: false,
            cards: [],
          },
          {
            id: "dup",
            name: "B",
            releaseYear: 2003,
            released: false,
            cards: [],
          },
        ],
      },
    ];
    for (const c of cases) {
      expect(parseShopSetData(c), JSON.stringify(c)).toBeNull();
    }
  });
});

describe("fetchShopSetData", () => {
  it("fresh payload replaces the cached one", async () => {
    const { cacheStorage, putCalls, putBodies } = makeFakeCache(VALID_FIXTURE);
    const stubFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(UPDATED_FIXTURE), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchShopSetData(stubFetch, cacheStorage);

    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(result.sets[1]!.released).toBe(true);
    expect(putCalls).toContain(SHOP_SET_DATA_URL);
    expect(JSON.parse(putBodies[0]!)).toEqual(UPDATED_FIXTURE);
  });

  it("offline visit falls back to the cached payload", async () => {
    const { cacheStorage, putCalls } = makeFakeCache(VALID_FIXTURE);
    const throwingFetch = vi.fn().mockRejectedValue(new Error("network"));

    const result = await fetchShopSetData(throwingFetch, cacheStorage);

    expect(throwingFetch).toHaveBeenCalledTimes(1);
    expect(result.sets).toHaveLength(2);
    expect(putCalls).toHaveLength(0);
  });

  it("stalled network falls back to the cached payload", async () => {
    const { cacheStorage, putCalls } = makeFakeCache(VALID_FIXTURE);
    const abortingFetch = vi
      .fn()
      .mockRejectedValue(
        new DOMException("The operation timed out.", "TimeoutError"),
      );

    const result = await fetchShopSetData(abortingFetch, cacheStorage);

    expect(abortingFetch).toHaveBeenCalledTimes(1);
    expect(result.sets).toHaveLength(2);
    expect(putCalls).toHaveLength(0);
  });

  it("non-ok response falls back to the cached payload", async () => {
    const { cacheStorage, putCalls } = makeFakeCache(VALID_FIXTURE);
    const stubFetch = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 404 }));

    const result = await fetchShopSetData(stubFetch, cacheStorage);

    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(result.sets).toHaveLength(2);
    expect(putCalls).toHaveLength(0);
  });

  it("invalid fresh payload falls back to the cached payload", async () => {
    const { cacheStorage, putCalls } = makeFakeCache(VALID_FIXTURE);
    const stubFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: 2, sets: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchShopSetData(stubFetch, cacheStorage);

    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(result.sets[1]!.released).toBe(false);
    expect(putCalls).toHaveLength(0);
  });

  it("corrupted cached payload with a failed fetch throws", async () => {
    const { cacheStorage } = makeFakeCache({ version: 2 });
    const rejectingFetch = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      fetchShopSetData(rejectingFetch, cacheStorage),
    ).rejects.toThrow("Shop data unavailable");
    expect(rejectingFetch).toHaveBeenCalledTimes(1);
  });

  it("network miss populates the cache", async () => {
    const { cacheStorage, putCalls } = makeFakeCache(null);
    const stubFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(VALID_FIXTURE), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchShopSetData(stubFetch, cacheStorage);

    expect(result.sets).toHaveLength(2);
    expect(putCalls).toContain(SHOP_SET_DATA_URL);
  });

  it("unavailable data throws", async () => {
    const { cacheStorage } = makeFakeCache(null);
    const rejectingFetch = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      fetchShopSetData(rejectingFetch, cacheStorage),
    ).rejects.toThrow("Shop data unavailable");
  });

  /* The fetch init is the contract, so both halves of it are pinned here:
     dropping `cache: "no-cache"` silently restores the stale-payload symptom,
     and the abort belongs only on the path that has a cached copy to fall back
     to. */
  it("a populated cache bounds the revalidation", async () => {
    const { cacheStorage } = makeFakeCache(VALID_FIXTURE);
    const stubFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(UPDATED_FIXTURE), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchShopSetData(stubFetch, cacheStorage);

    const init = stubFetch.mock.calls[0]![1] as RequestInit;
    expect(init.cache).toBe("no-cache");
    expect(init.signal).toBeDefined();
  });

  it("a cold cache fetches unbounded", async () => {
    const { cacheStorage } = makeFakeCache(null);
    const stubFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(VALID_FIXTURE), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchShopSetData(stubFetch, cacheStorage);

    const init = stubFetch.mock.calls[0]![1] as RequestInit;
    expect(init.cache).toBe("no-cache");
    expect(init.signal).toBeUndefined();
  });

  it("a refused cache write still returns the fresh payload", async () => {
    const { cacheStorage } = makeFakeCache(VALID_FIXTURE);
    const cache = await cacheStorage.open(SHOP_SET_DATA_CACHE);
    vi.spyOn(cache, "put").mockRejectedValue(
      new DOMException("Quota exceeded.", "QuotaExceededError"),
    );
    const stubFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(UPDATED_FIXTURE), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchShopSetData(stubFetch, cacheStorage);

    expect(result.sets[1]!.released).toBe(true);
  });
});

describe("contentsOf", () => {
  it("maps cards to ShopCardOffer shape", () => {
    const offers = contentsOf(VALID_FIXTURE, "alpha");
    expect(offers).toHaveLength(2);
    expect(offers[0]).toEqual({ code: 89631139, rarity: "ultra-rare" });
    expect(offers[1]).toEqual({ code: 46986414, rarity: "rare" });
  });

  it("returns empty for unknown set id", () => {
    expect(contentsOf(VALID_FIXTURE, "nonexistent")).toHaveLength(0);
  });
});

describe("resolveCardRarity", () => {
  it("prefers printed, falls back to inference, then common", () => {
    // code in data across two sets (rare in alpha, secret-rare in beta) → secret-rare
    expect(resolveCardRarity(89631139, VALID_FIXTURE, undefined)).toBe(
      "secret-rare",
    );

    // code absent from data, view has ATK >= 3000 → secret-rare via inferRarity
    expect(
      resolveCardRarity(99999, VALID_FIXTURE, fakeView({ attack: 3000 })),
    ).toBe("secret-rare");

    // code absent from data, no view → common
    expect(resolveCardRarity(99999, VALID_FIXTURE, undefined)).toBe("common");

    // data null, view provided → inferRarity result
    expect(
      resolveCardRarity(
        99999,
        null,
        fakeView({ family: "spell", subtypes: ["Continuous"], attack: null }),
      ),
    ).toBe("rare");

    // data null, no view → common
    expect(resolveCardRarity(99999, null, undefined)).toBe("common");
  });
});

describe("SHOP_SET_DATA constants", () => {
  it("URL is built from the deployed base path", () => {
    expect(SHOP_SET_DATA_URL).toBe(
      `${import.meta.env.BASE_URL}story/shop-sets.v1.json`,
    );
    expect(SHOP_SET_DATA_CACHE).toBe("story-shop-data");
  });

  /* The production bundle is served under a base path (the PWA deploy and the
     Playwright preview both use one), so a leading-slash literal would fetch
     off the deployment root and leave the shop permanently in its error
     state. */
  it("URL follows a non-root base path", async () => {
    vi.stubEnv("BASE_URL", "/ygo-story-duel/");
    vi.resetModules();
    try {
      const reloaded =
        await import("../../../src/story/shop/data/shop-set-data.ts");
      expect(reloaded.SHOP_SET_DATA_URL).toBe(
        "/ygo-story-duel/story/shop-sets.v1.json",
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe("shipped JSON invariants", () => {
  const jsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../public/story/shop-sets.v1.json",
  );

  it("shipped data holds fifty ordered sets", () => {
    const raw: unknown = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const data = parseShopSetData(raw);
    expect(data, "JSON does not parse as ShopSetData").not.toBeNull();

    const { sets } = data!;
    expect(sets).toHaveLength(50);

    // releaseYear non-decreasing
    for (let i = 1; i < sets.length; i++) {
      expect(sets[i]!.releaseYear).toBeGreaterThanOrEqual(
        sets[i - 1]!.releaseYear,
      );
    }

    // ids unique and kebab-case
    const ids = new Set<string>();
    for (const s of sets) {
      expect(s.id, `id "${s.id}" is not kebab-case`).toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
      );
      expect(ids.has(s.id), `duplicate id "${s.id}"`).toBe(false);
      ids.add(s.id);
    }

    // exactly first 3 released
    const releasedIds = sets.filter((s) => s.released).map((s) => s.id);
    expect(releasedIds).toEqual([
      "legend-of-blue-eyes-white-dragon",
      "metal-raiders",
      "pharaohs-servant",
    ]);

    // every set non-empty, every card valid
    for (const s of sets) {
      expect(s.cards.length, `set "${s.id}" is empty`).toBeGreaterThan(0);
      for (const c of s.cards) {
        expect(typeof c.code).toBe("number");
        expect(Number.isInteger(c.code)).toBe(true);
        expect(typeof c.name).toBe("string");
        expect([
          "common",
          "rare",
          "super-rare",
          "ultra-rare",
          "secret-rare",
          "ultimate-rare",
          "ghost-rare",
        ]).toContain(c.rarity);
      }
    }
  });
});
