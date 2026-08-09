import { describe, expect, it } from "vitest";
import {
  cardPreviewForCode,
  type CardPreviewText,
} from "../../src/app/presentation/card-preview.ts";
import { cardCode } from "../../src/duel/contracts/ids.ts";

const KNOWN = cardCode(97590747);
const UNKNOWN = cardCode(46986414);
const NAMELESS = cardCode(89631139);

const TEXTS: ReadonlyMap<number, CardPreviewText> = new Map<
  number,
  CardPreviewText
>([
  [
    KNOWN,
    {
      name: "The Legendary Fisherman",
      description: "This card is unaffected by Spell effects.",
    },
  ],
  [NAMELESS, { name: "Blue-Eyes White Dragon" }],
]);

describe("cardPreviewForCode", () => {
  it("no code means no preview", () => {
    expect(cardPreviewForCode(undefined, TEXTS)).toBeNull();
  });

  it("known code resolves name and text", () => {
    expect(cardPreviewForCode(KNOWN, TEXTS)).toEqual({
      code: KNOWN,
      name: "The Legendary Fisherman",
      description: "This card is unaffected by Spell effects.",
    });
  });

  it("unknown code falls back", () => {
    expect(cardPreviewForCode(UNKNOWN, TEXTS)).toEqual({
      code: UNKNOWN,
      name: `Card ${UNKNOWN}`,
      description: "No card text available.",
    });
  });

  it("missing description falls back", () => {
    expect(cardPreviewForCode(NAMELESS, TEXTS)).toEqual({
      code: NAMELESS,
      name: "Blue-Eyes White Dragon",
      description: "No card text available.",
    });
  });
});
