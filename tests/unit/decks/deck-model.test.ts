import { describe, expect, it } from "vitest";
import {
  applyDeckCommand,
  sortDeckCards,
  sortDeckCardsAlphabetical,
} from "../../../src/decks/deck-model.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";

const catalog = catalogByCode(PROTOTYPE_CATALOG);
const empty = {
  main: [] as number[],
  extra: [] as number[],
  side: [] as number[],
};

describe("deck editing model", () => {
  it("adds catalog cards to one canonical Main or Extra target", () => {
    const main = applyDeckCommand(
      empty,
      { type: "add", cardCode: 89631139 },
      catalog,
      PROTOTYPE_RULESET,
    );
    const extra = applyDeckCommand(
      empty,
      { type: "add", cardCode: 8505920 },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(main.type === "accepted" && main.cards.main).toEqual([89631139]);
    expect(extra.type === "accepted" && extra.cards.extra).toEqual([8505920]);
  });

  it("add appends to the end of its zone", () => {
    const result = applyDeckCommand(
      { main: [44095762, 12580477], extra: [], side: [] },
      { type: "add", cardCode: 89631139 },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result.type === "accepted" && result.cards.main).toEqual([
      44095762, 12580477, 89631139,
    ]);
  });

  it("add with an explicit side zone lands in the side deck", () => {
    const result = applyDeckCommand(
      empty,
      { type: "add", cardCode: 89631139, zone: "side" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result.type === "accepted" && result.cards).toEqual({
      main: [],
      extra: [],
      side: [89631139],
    });
  });

  it("add rejects a zone that is neither canonical nor side", () => {
    expect(
      applyDeckCommand(
        empty,
        { type: "add", cardCode: 89631139, zone: "extra" },
        catalog,
        PROTOTYPE_RULESET,
      ),
    ).toEqual({
      type: "rejected",
      reason: "Card cannot be added to that zone.",
    });
  });

  it("rejects forbidden catalog cards without mutating the deck", () => {
    const result = applyDeckCommand(
      empty,
      { type: "add", cardCode: 10000000 },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result).toEqual({ type: "rejected", reason: "Card is forbidden." });
    expect(empty).toEqual({ main: [], extra: [], side: [] });
  });

  it("moves cards to Side and returns them only to their canonical zone", () => {
    const deck = { main: [89631139], extra: [8505920], side: [] };
    const toSide = applyDeckCommand(
      deck,
      { type: "move", cardCode: 8505920, from: "extra", to: "side" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(toSide.type).toBe("accepted");
    if (toSide.type !== "accepted") return;
    expect(toSide.cards).toEqual({
      main: [89631139],
      extra: [],
      side: [8505920],
    });
    const back = applyDeckCommand(
      toSide.cards,
      { type: "move", cardCode: 8505920, from: "side", to: "extra" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(back.type === "accepted" && back.cards.extra).toEqual([8505920]);
    expect(
      applyDeckCommand(
        toSide.cards,
        { type: "move", cardCode: 8505920, from: "side", to: "main" },
        catalog,
        PROTOTYPE_RULESET,
      ),
    ).toMatchObject({ type: "rejected" });
  });

  it("move appends to the target zone end", () => {
    const result = applyDeckCommand(
      { main: [89631139], extra: [], side: [44095762, 12580477] },
      { type: "move", cardCode: 89631139, from: "main", to: "side" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result.type === "accepted" && result.cards.side).toEqual([
      44095762, 12580477, 89631139,
    ]);
  });

  it("import preserves the given order", () => {
    const result = applyDeckCommand(
      empty,
      {
        type: "import",
        cards: { main: [44095762, 89631139, 12580477], extra: [], side: [] },
      },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result).toMatchObject({
      type: "accepted",
      reason: "import",
      cards: { main: [44095762, 89631139, 12580477] },
    });
  });

  it("restore preserves order and reports reason restore", () => {
    const result = applyDeckCommand(
      { main: [89631139], extra: [], side: [] },
      {
        type: "restore",
        cards: { main: [44095762, 89631139, 12580477], extra: [], side: [] },
      },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result).toMatchObject({
      type: "accepted",
      reason: "restore",
      cards: { main: [44095762, 89631139, 12580477] },
    });
  });

  it("reorder swaps two occupied slots", () => {
    const result = applyDeckCommand(
      { main: [89631139, 12580477, 44095762], extra: [], side: [] },
      { type: "reorder", zone: "main", from: 0, to: 2 },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result).toMatchObject({
      type: "accepted",
      reason: "reorder",
      cards: { main: [44095762, 12580477, 89631139] },
    });
  });

  it("reorder past the end moves the card to the last position", () => {
    const result = applyDeckCommand(
      { main: [89631139, 12580477, 44095762], extra: [], side: [] },
      { type: "reorder", zone: "main", from: 0, to: 9 },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result.type === "accepted" && result.cards.main).toEqual([
      12580477, 44095762, 89631139,
    ]);
  });

  it("reorder rejects an empty source index", () => {
    expect(
      applyDeckCommand(
        { main: [89631139], extra: [], side: [] },
        { type: "reorder", zone: "main", from: 3, to: 0 },
        catalog,
        PROTOTYPE_RULESET,
      ),
    ).toEqual({ type: "rejected", reason: "Nothing to reorder." });
  });

  it("reorder rejects a fractional target index", () => {
    expect(
      applyDeckCommand(
        { main: [89631139, 12580477], extra: [], side: [] },
        { type: "reorder", zone: "main", from: 0, to: 1.5 },
        catalog,
        PROTOTYPE_RULESET,
      ),
    ).toEqual({ type: "rejected", reason: "Nothing to reorder." });
  });

  it("sort type groups monsters, spells then traps alphabetically", () => {
    const result = applyDeckCommand(
      { main: [44095762, 12580477, 89631139], extra: [], side: [] },
      { type: "sort", mode: "type" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result).toMatchObject({
      type: "accepted",
      reason: "sort",
      cards: { main: [89631139, 12580477, 44095762] },
    });
  });

  it("sort alpha orders the main deck by name", () => {
    const result = applyDeckCommand(
      { main: [44095762, 12580477, 89631139], extra: [], side: [] },
      { type: "sort", mode: "alpha" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(result).toMatchObject({
      type: "accepted",
      reason: "sort",
      cards: { main: [89631139, 44095762, 12580477] },
    });
  });

  it("removes one repeated tile and enforces the pinned copy limit", () => {
    let cards = { ...empty };
    for (let index = 0; index < 3; index += 1) {
      const result = applyDeckCommand(
        cards,
        { type: "add", cardCode: 89631139 },
        catalog,
        PROTOTYPE_RULESET,
      );
      expect(result.type).toBe("accepted");
      if (result.type === "accepted") cards = result.cards as typeof cards;
    }
    expect(cards.main).toEqual([89631139, 89631139, 89631139]);
    expect(
      applyDeckCommand(
        cards,
        { type: "add", cardCode: 89631139 },
        catalog,
        PROTOTYPE_RULESET,
      ),
    ).toMatchObject({ type: "rejected", reason: "Copy limit 3 reached." });
    const removed = applyDeckCommand(
      cards,
      { type: "remove", cardCode: 89631139, zone: "main" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(removed.type === "accepted" && removed.cards.main).toHaveLength(2);
  });

  it("removes the first copy and keeps the remaining order", () => {
    const removed = applyDeckCommand(
      { main: [12580477, 89631139, 44095762], extra: [], side: [] },
      { type: "remove", cardCode: 89631139, zone: "main" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(removed.type === "accepted" && removed.cards.main).toEqual([
      12580477, 44095762,
    ]);
  });

  it("removes missing-card placeholders without catalog data", () => {
    const removed = applyDeckCommand(
      { main: [99999999], extra: [], side: [] },
      { type: "remove", cardCode: 99999999, zone: "main" },
      catalog,
      PROTOTYPE_RULESET,
    );
    expect(removed).toMatchObject({ type: "accepted", cards: { main: [] } });
  });

  it("orders Side by canonical Main/Extra class", () => {
    expect(
      sortDeckCards(
        { main: [], extra: [], side: [8505920, 44095762, 89631139] },
        catalog,
      ).side,
    ).toEqual([89631139, 44095762, 8505920]);
  });

  it("packs cards deterministically when an explicit sort is asked for", () => {
    expect(
      sortDeckCards(
        { main: [44095762, 12580477, 89631139], extra: [], side: [] },
        catalog,
      ).main,
    ).toEqual([89631139, 12580477, 44095762]);
  });

  it("sorts every zone by name and pushes uncatalogued codes last", () => {
    expect(
      sortDeckCardsAlphabetical(
        {
          main: [99999999, 12580477, 89631139, 99999998],
          extra: [8505920, 1322368],
          side: [44095762, 46986414],
        },
        catalog,
      ),
    ).toEqual({
      main: [89631139, 12580477, 99999998, 99999999],
      extra: [8505920, 1322368],
      side: [46986414, 44095762],
    });
  });
});
