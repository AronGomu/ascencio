import { describe, expect, it } from "vitest";
import { deckId } from "../../../src/decks/deck-contracts.ts";
import { orderDeckLibrary } from "../../../src/decks/deck-library-order.ts";
import { deckFixture } from "../../fixtures/deck-editor.ts";

function deck(id: string, name: string, updatedAt: string) {
  return Object.freeze({
    ...deckFixture(),
    id: deckId(id),
    name,
    updatedAt,
  });
}

describe("orderDeckLibrary", () => {
  it("puts the default first, then sorts the rest by last modified", () => {
    const d1 = deck("d1", "Alpha", "2026-01-01T00:00:00.000Z");
    const d2 = deck("d2", "Beta", "2026-01-02T00:00:00.000Z");
    const d3 = deck("d3", "Gamma", "2026-01-03T00:00:00.000Z");

    const result = orderDeckLibrary([d1, d2, d3], {
      defaultDeckId: deckId("d1"),
      sort: "modified",
    });

    expect(result.map(({ id }) => id)).toEqual(["d1", "d3", "d2"]);
  });

  it("puts the default first, then sorts the rest by name", () => {
    const dA = deck("dA", "Alpha", "2026-01-01T00:00:00.000Z");
    const dB = deck("dB", "Beta", "2026-01-02T00:00:00.000Z");
    const dC = deck("dC", "Charlie", "2026-01-03T00:00:00.000Z");

    const result = orderDeckLibrary([dC, dB, dA], {
      defaultDeckId: deckId("dC"),
      sort: "name",
    });

    expect(result.map(({ id }) => id)).toEqual(["dC", "dA", "dB"]);
  });
});
