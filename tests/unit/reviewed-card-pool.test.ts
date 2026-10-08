import { describe, expect, it } from "vitest";
import type { DeckId } from "../../src/battle/duel/presets/deck-catalog.ts";
import { reviewedCardPool } from "../../src/battle/duel/presets/reviewed-card-pool.ts";

describe("reviewed card pool", () => {
  it("pool is the union of every supplied deck", () => {
    const sources = new Map<DeckId, string>([
      ["chapter-one-starter", "#main\n1\n2\n"],
      ["chapter-one-practice", "#main\n2\n3\n"],
    ]);

    expect(reviewedCardPool(sources)).toEqual(new Set([1, 2, 3]));
  });

  it("pool includes extra deck codes", () => {
    const sources = new Map<DeckId, string>([
      ["chapter-one-starter", "#main\n1\n#extra\n9\n!side\n"],
    ]);

    expect(reviewedCardPool(sources).has(9)).toBe(true);
  });
});
