import { describe, expect, it } from "vitest";
import {
  FIFTEEN_CARD_GRID,
  mainDeckGridPlan,
} from "../../../src/decks/deck-model.ts";

describe("deck grid plans", () => {
  it("forty or fewer cards keeps the four-row forty-slot grid", () => {
    expect(mainDeckGridPlan(0)).toEqual({
      columns: 10,
      rows: 4,
      slots: 40,
      compact: false,
    });
    expect(mainDeckGridPlan(40)).toEqual({
      columns: 10,
      rows: 4,
      slots: 40,
      compact: false,
    });
  });

  it("forty-one to fifty cards adds a fifth row of ten", () => {
    expect(mainDeckGridPlan(41)).toEqual({
      columns: 10,
      rows: 5,
      slots: 50,
      compact: false,
    });
    expect(mainDeckGridPlan(50)).toEqual({
      columns: 10,
      rows: 5,
      slots: 50,
      compact: false,
    });
  });

  it("fifty-one or more cards adds a sixth row of ten", () => {
    expect(mainDeckGridPlan(51)).toEqual({
      columns: 10,
      rows: 6,
      slots: 60,
      compact: false,
    });
    expect(mainDeckGridPlan(61)).toEqual({
      columns: 10,
      rows: 6,
      slots: 60,
      compact: false,
    });
  });

  it("keeps Extra and Side at 15 slots", () => {
    expect(FIFTEEN_CARD_GRID).toEqual({
      columns: 5,
      rows: 3,
      slots: 15,
      compact: false,
    });
  });
});
