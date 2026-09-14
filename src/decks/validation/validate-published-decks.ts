import { cardCode, type Cards } from "../../cards/index.ts";
import { OCG_TYPE, hasOcgType } from "../../cards/classification/index.ts";
import type { DeckCardLists } from "../deck-contracts.ts";
import { isExtraDeckType } from "../catalog/ocg-card-mapper.ts";
import {
  quantityLimit,
  type PinnedDeckRuleset,
} from "../catalog/pinned-ruleset.ts";

export function validatePublishedDecks(
  decks: readonly DeckCardLists[],
  cards: Cards,
  ruleset: PinnedDeckRuleset,
): void {
  const fail = (): never => {
    throw new Error("DECK_RELEASE_INVALID");
  };
  for (const deck of decks) {
    const counts = new Map<number, number>();
    for (const zone of ["main", "extra", "side"] as const) {
      for (const code of deck[zone]) {
        if (!Number.isSafeInteger(code) || code <= 0) fail();
        const definition = cards.get(cardCode(code)) ?? fail();
        if (hasOcgType(definition.type, OCG_TYPE.TOKEN)) fail();
        const extra = isExtraDeckType(definition.type);
        if ((zone === "main" && extra) || (zone === "extra" && !extra)) fail();
        const count = (counts.get(code) ?? 0) + 1;
        if (count > quantityLimit(ruleset, code)) fail();
        counts.set(code, count);
      }
    }
  }
}
