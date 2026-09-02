import { describe, expect, it } from "vitest";
import type { DeckTileModel } from "../../../src/deck-select/deck-select-contracts.ts";
import {
  orderDeckTiles,
  pinSelectedFirst,
} from "../../../src/deck-select/order-deck-tiles.ts";

function tile(overrides: Partial<DeckTileModel> = {}): DeckTileModel {
  return Object.freeze({
    key: "d1",
    name: "Deck",
    counts: Object.freeze({ main: 40, extra: 0, side: 0 }),
    meta: "Bundled",
    coverImageUrl: null,
    legal: true,
    blockReason: null,
    bundled: false,
    lockedBy: null,
    favourite: false,
    isDefault: false,
    deletable: true,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("orderDeckTiles", () => {
  it("illegal decks sink below every legal deck", () => {
    const blocked = tile({
      key: "blocked",
      legal: false,
      blockReason: "Too few cards",
      favourite: true,
      isDefault: true,
    });
    const plain = tile({ key: "plain" });

    const result = orderDeckTiles([blocked, plain], "modified");

    expect(result.map(({ key }) => key)).toEqual(["plain", "blocked"]);
  });

  it("default outranks plain", () => {
    const plain = tile({ key: "plain" });
    const chosen = tile({ key: "chosen", isDefault: true });

    const result = orderDeckTiles([plain, chosen], "modified");

    expect(result.map(({ key }) => key)).toEqual(["chosen", "plain"]);
  });

  it("modified sort orders by updatedAt desc, null last", () => {
    const older = tile({ key: "older", updatedAt: "2026-01-01T00:00:00.000Z" });
    const undated = tile({ key: "undated", updatedAt: null });
    const newer = tile({ key: "newer", updatedAt: "2026-01-02T00:00:00.000Z" });

    const result = orderDeckTiles([older, undated, newer], "modified");

    expect(result.map(({ key }) => key)).toEqual(["newer", "older", "undated"]);
  });

  it("name sort uses localeCompare", () => {
    const lower = tile({ key: "lower", name: "b" });
    const upper = tile({ key: "upper", name: "A" });

    const result = orderDeckTiles([lower, upper], "name");

    expect(result.map(({ key }) => key)).toEqual(["upper", "lower"]);
  });

  it("input array is not mutated and result is frozen", () => {
    const input = [
      tile({ key: "plain" }),
      tile({ key: "chosen", isDefault: true }),
    ];

    const result = orderDeckTiles(input, "name");

    expect(Object.isFrozen(result)).toBe(true);
    expect(input.map(({ key }) => key)).toEqual(["plain", "chosen"]);
  });
});

describe("pinSelectedFirst", () => {
  const ranked = [
    tile({ key: "k1" }),
    tile({ key: "k2" }),
    tile({ key: "k3" }),
  ];

  it("moves the selection to slot 1, the rest in rank order behind it", () => {
    const result = pinSelectedFirst(ranked, "k3");

    expect(result.map(({ key }) => key)).toEqual(["k3", "k1", "k2"]);
  });

  it("leaves the order alone when nothing is selected or the key is absent", () => {
    expect(pinSelectedFirst(ranked, null).map(({ key }) => key)).toEqual([
      "k1",
      "k2",
      "k3",
    ]);
    expect(pinSelectedFirst(ranked, "kX").map(({ key }) => key)).toEqual([
      "k1",
      "k2",
      "k3",
    ]);
  });

  it("input array is not mutated and result is frozen", () => {
    const input = [tile({ key: "k1" }), tile({ key: "k2" })];

    const result = pinSelectedFirst(input, "k2");

    expect(Object.isFrozen(result)).toBe(true);
    expect(input.map(({ key }) => key)).toEqual(["k1", "k2"]);
  });
});
