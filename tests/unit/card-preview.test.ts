import { describe, expect, it } from "vitest";
import {
  cardPreviewForCode,
  cardPreviewForPublicCard,
  type CardPreviewText,
  type PreviewablePublicCard,
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

function publicCard(
  overrides: Partial<PreviewablePublicCard> = {},
): PreviewablePublicCard {
  return {
    code: KNOWN,
    controller: 0,
    location: "hand",
    position: "faceDownAttack",
    ...overrides,
  };
}

describe("cardPreviewForPublicCard", () => {
  it("previews a card the local player controls", () => {
    expect(cardPreviewForPublicCard(publicCard(), TEXTS)).toEqual({
      code: KNOWN,
      name: "The Legendary Fisherman",
      description: "This card is unaffected by Spell effects.",
    });
  });

  it("previews a face-up opponent card", () => {
    expect(
      cardPreviewForPublicCard(
        publicCard({
          controller: 1,
          location: "monster",
          position: "faceUpAttack",
        }),
        TEXTS,
      ),
    ).not.toBeNull();
  });

  /* A code that leaked onto a card whose identity is hidden from player 0 must
     never reach the panel, whatever the caller pre-filtered. */
  it("refuses a card whose identity is hidden from the local player", () => {
    expect(
      cardPreviewForPublicCard(
        publicCard({
          controller: 1,
          location: "hand",
          position: "faceDownAttack",
        }),
        TEXTS,
      ),
    ).toBeNull();
    expect(
      cardPreviewForPublicCard(
        publicCard({
          controller: 1,
          location: "monster",
          position: "faceDownDefense",
        }),
        TEXTS,
      ),
    ).toBeNull();
  });

  it("no code means no preview", () => {
    expect(
      cardPreviewForPublicCard(
        { controller: 0, location: "hand", position: "faceDownAttack" },
        TEXTS,
      ),
    ).toBeNull();
  });
});
