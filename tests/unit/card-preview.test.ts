import { describe, expect, it } from "vitest";
import {
  cardPreviewForCode,
  cardPreviewForPublicCard,
  formatCardStatsLine,
  stackTopCode,
  type CardPreviewText,
  type PreviewablePublicCard,
} from "../../src/battle/app/presentation/card-preview.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";

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
      statsLine: null,
    });
  });

  it("unknown code falls back", () => {
    expect(cardPreviewForCode(UNKNOWN, TEXTS)).toEqual({
      code: UNKNOWN,
      name: `Card ${UNKNOWN}`,
      description: "No card text available.",
      statsLine: null,
    });
  });

  it("missing description falls back", () => {
    expect(cardPreviewForCode(NAMELESS, TEXTS)).toEqual({
      code: NAMELESS,
      name: "Blue-Eyes White Dragon",
      description: "No card text available.",
      statsLine: null,
    });
  });

  it("carries the stats line from text fields", () => {
    const textsWithStats: ReadonlyMap<number, CardPreviewText> = new Map([
      [
        KNOWN,
        {
          name: "Dark Magician",
          description: "The ultimate wizard in terms of attack and defense.",
          family: "monster",
          attribute: "DARK",
          race: "Spellcaster",
          ratingLabel: "Level",
          levelRankLink: 7,
          attack: 2500,
          defense: 2100,
        },
      ],
    ]);
    const result = cardPreviewForCode(KNOWN, textsWithStats);
    expect(result?.statsLine).toBe(
      "DARK · Spellcaster · Level 7 · ATK 2500 / DEF 2100",
    );
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
      statsLine: null,
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

  it("previews projector-known face-down fixed-field identity", () => {
    expect(
      cardPreviewForPublicCard(
        publicCard({
          controller: 1,
          location: "monster",
          position: "faceDownDefense",
        }),
        TEXTS,
      ),
    ).toEqual({
      code: KNOWN,
      name: "The Legendary Fisherman",
      description: "This card is unaffected by Spell effects.",
      statsLine: null,
    });
  });

  it("keeps unknown concealed opponent identity private", () => {
    expect(
      cardPreviewForPublicCard(
        {
          controller: 1,
          location: "hand",
          position: "faceDownAttack",
        },
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

describe("formatCardStatsLine", () => {
  it("formats a monster stat line", () => {
    expect(
      formatCardStatsLine({
        name: "Dark Magician",
        family: "monster",
        attribute: "DARK",
        race: "Spellcaster",
        ratingLabel: "Level",
        levelRankLink: 4,
        attack: 1800,
        defense: 1200,
      }),
    ).toBe("DARK · Spellcaster · Level 4 · ATK 1800 / DEF 1200");
  });

  it("formats a link monster without defense", () => {
    expect(
      formatCardStatsLine({
        name: "Decode Talker",
        family: "monster",
        attribute: "DARK",
        race: "Cyberse",
        ratingLabel: "Link",
        levelRankLink: 2,
        attack: 1400,
        defense: null,
      }),
    ).toBe("DARK · Cyberse · Link 2 · ATK 1400");
  });

  it("renders unknown attack as a question mark", () => {
    expect(
      formatCardStatsLine({
        name: "Some Monster",
        family: "monster",
        attack: null,
        defense: 0,
      }),
    ).toBe("ATK ? / DEF 0");
  });

  it("formats a spell with its subtype", () => {
    expect(
      formatCardStatsLine({
        name: "Mystical Space Typhoon",
        family: "spell",
        subtypes: ["Quick-Play"],
      }),
    ).toBe("Spell · Quick-Play");
  });

  it("formats a spell with no subtype", () => {
    expect(
      formatCardStatsLine({
        name: "Pot of Greed",
        family: "spell",
        subtypes: [],
      }),
    ).toBe("Spell");
  });

  it("returns null without family data", () => {
    expect(
      formatCardStatsLine({ name: "Unknown", description: "Some text" }),
    ).toBeNull();
  });
});

describe("stackTopCode", () => {
  it("returns the stack's top card code", () => {
    expect(stackTopCode({ topCardCode: KNOWN })).toBe(KNOWN);
  });

  it("returns undefined when nothing in the stack is public", () => {
    expect(stackTopCode({})).toBeUndefined();
  });
});
