import {
  adaptAssetDeckCard,
  mapDeckBuilderCard,
  type DeckBuilderCardView,
} from "../../src/decks/catalog/ocg-card-mapper.ts";
import {
  OCG_ATTRIBUTE,
  OCG_RACE,
  OCG_TYPE,
} from "../../src/decks/catalog/ocg-mask.ts";

export const SHEEP_TOKEN_CODE = 73915052;

/**
 * One Token, shaped the way the runtime catalog carries all 243 of them.
 *
 * It lives here rather than in `PROTOTYPE_CATALOG` because the fixture catalog
 * is what the editor offers in every other test, and a Token is exactly what it
 * must not offer.
 */
export const SHEEP_TOKEN: DeckBuilderCardView = mapDeckBuilderCard(
  adaptAssetDeckCard(
    {
      code: SHEEP_TOKEN_CODE,
      alias: 0,
      setcodes: [],
      type: OCG_TYPE.MONSTER | OCG_TYPE.NORMAL | OCG_TYPE.TOKEN,
      level: 1,
      attribute: OCG_ATTRIBUTE.EARTH,
      race: String(OCG_RACE.BEAST),
      attack: 0,
      defense: 0,
      lscale: 0,
      rscale: 0,
      linkMarker: 0,
      ot: 3,
    },
    {
      code: SHEEP_TOKEN_CODE,
      name: "Sheep Token",
      description: "This card can be used as a Sheep Token.",
      strings: [],
    },
  ),
);
