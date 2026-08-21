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
  it("default deck leads, then favourites, then the rest", () => {
    const d1 = deck("d1", "Alpha", "2026-01-01T00:00:00.000Z");
    const d2 = deck("d2", "Beta", "2026-01-02T00:00:00.000Z");
    const d3 = deck("d3", "Gamma", "2026-01-03T00:00:00.000Z");
    const d4 = deck("d4", "Delta", "2026-01-04T00:00:00.000Z");

    const result = orderDeckLibrary([d1, d2, d3, d4], {
      defaultDeckId: deckId("d3"),
      favouriteDeckIds: [deckId("d4")],
      sort: "modified",
    });

    expect(result.map(({ id }) => id)).toEqual(["d3", "d4", "d2", "d1"]);
  });

  it("the default deck outranks its own favourite flag", () => {
    const d1 = deck("d1", "Alpha", "2026-01-01T00:00:00.000Z");
    const d2 = deck("d2", "Beta", "2026-01-02T00:00:00.000Z");

    const result = orderDeckLibrary([d2, d1], {
      defaultDeckId: deckId("d1"),
      favouriteDeckIds: [deckId("d1"), deckId("d2")],
      sort: "modified",
    });

    expect(result.map(({ id }) => id)).toEqual(["d1", "d2"]);
  });

  it("name sort orders inside each group", () => {
    const dA = deck("dA", "Alpha", "2026-01-01T00:00:00.000Z");
    const dB = deck("dB", "Beta", "2026-01-02T00:00:00.000Z");

    const result = orderDeckLibrary([dB, dA], {
      defaultDeckId: null,
      favouriteDeckIds: [deckId("dB"), deckId("dA")],
      sort: "name",
    });

    expect(result.map(({ id }) => id)).toEqual(["dA", "dB"]);
  });

  it("an unknown favourite id is ignored", () => {
    const d1 = deck("d1", "Alpha", "2026-01-01T00:00:00.000Z");
    const d2 = deck("d2", "Beta", "2026-01-02T00:00:00.000Z");

    const result = orderDeckLibrary([d1, d2], {
      defaultDeckId: null,
      favouriteDeckIds: [deckId("gone")],
      sort: "modified",
    });

    expect(result).toHaveLength(2);
    expect(result.map(({ id }) => id)).toEqual(["d2", "d1"]);
  });
});
