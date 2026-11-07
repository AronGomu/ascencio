import { describe, expect, it } from "vitest";

import { OCG_TYPE } from "../../src/decks/catalog/ocg-mask.js";
import { CARD_FRAME_COLORS, cardFrameOf } from "../../src/decks/card-frame.js";

describe("cardFrameOf", () => {
  it("classifies spell cards", () => {
    expect(cardFrameOf(OCG_TYPE.SPELL | OCG_TYPE.QUICKPLAY)).toBe("spell");
  });

  it("classifies trap cards", () => {
    expect(cardFrameOf(OCG_TYPE.TRAP | OCG_TYPE.COUNTER)).toBe("trap");
  });

  it("prioritizes link over effect", () => {
    expect(
      cardFrameOf(OCG_TYPE.MONSTER | OCG_TYPE.LINK | OCG_TYPE.EFFECT),
    ).toBe("link");
  });

  it("classifies xyz cards", () => {
    expect(cardFrameOf(OCG_TYPE.MONSTER | OCG_TYPE.XYZ)).toBe("xyz");
  });

  it("prioritizes synchro over effect", () => {
    expect(
      cardFrameOf(OCG_TYPE.MONSTER | OCG_TYPE.SYNCHRO | OCG_TYPE.EFFECT),
    ).toBe("synchro");
  });

  it("prioritizes fusion over pendulum", () => {
    expect(
      cardFrameOf(OCG_TYPE.MONSTER | OCG_TYPE.FUSION | OCG_TYPE.PENDULUM),
    ).toBe("fusion");
  });

  it("classifies ritual cards", () => {
    expect(cardFrameOf(OCG_TYPE.MONSTER | OCG_TYPE.RITUAL)).toBe("ritual");
  });

  it("classifies effect cards", () => {
    expect(cardFrameOf(OCG_TYPE.MONSTER | OCG_TYPE.EFFECT)).toBe("effect");
  });

  it("classifies normal cards", () => {
    expect(cardFrameOf(OCG_TYPE.MONSTER | OCG_TYPE.NORMAL)).toBe("normal");
  });

  it("defaults unmatched types to normal", () => {
    expect(cardFrameOf(0)).toBe("normal");
  });
});

describe("CARD_FRAME_COLORS", () => {
  it("contains approved colors for every card frame", () => {
    expect(CARD_FRAME_COLORS).toEqual({
      normal: "#b8985a",
      effect: "#c26a3d",
      ritual: "#4a6fb5",
      fusion: "#8a63b0",
      synchro: "#c9c9c9",
      xyz: "#4a4a55",
      link: "#1d6ea8",
      spell: "#1d9e74",
      trap: "#bc5a84",
    });
  });
});
