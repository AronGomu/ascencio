import { describe, expect, it } from "vitest";
import type { DeckTileModel } from "../../../src/deck-select/deck-select-contracts.ts";
import { orderDeckTiles } from "../../../src/deck-select/order-deck-tiles.ts";

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

  it("default outranks favourite", () => {
    const favourite = tile({ key: "favourite", favourite: true });
    const chosen = tile({ key: "chosen", isDefault: true });

    const result = orderDeckTiles([favourite, chosen], "modified");

    expect(result.map(({ key }) => key)).toEqual(["chosen", "favourite"]);
  });

  it("favourite outranks plain", () => {
    const plain = tile({ key: "plain" });
    const favourite = tile({ key: "favourite", favourite: true });

    const result = orderDeckTiles([plain, favourite], "modified");

    expect(result.map(({ key }) => key)).toEqual(["favourite", "plain"]);
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
