import type { CardCode } from "../contracts/ids.ts";
import type { ParsedDeck } from "./deck-parser.ts";

/** Catalog type bit that identifies a Link monster. */
export const TYPE_LINK = 0x04000000;

export type EngineMasterRule = "mr3" | "mr5";

export interface DuelRulesProfile {
  readonly rules: EngineMasterRule;
  readonly extraMonsterZones: boolean;
}

const LINK_FREE_PROFILE: DuelRulesProfile = Object.freeze({
  rules: "mr3",
  extraMonsterZones: false,
});
const LINK_PROFILE: DuelRulesProfile = Object.freeze({
  rules: "mr5",
  extraMonsterZones: true,
});

/**
 * One immutable rules/layout profile for the selected pair, decided once at
 * duel start. A Link monster anywhere in either selected deck keeps Master
 * Rule 5 and its shared Extra Monster Zones; a Link-free pair runs Master
 * Rule 3, where no Extra Monster Zone exists in the engine either.
 */
export function selectedDeckPairRulesProfile(
  player: ParsedDeck,
  opponent: ParsedDeck,
  cards: ReadonlyMap<number, { readonly type: number }>,
): DuelRulesProfile {
  let containsLink = false;
  for (const deck of [player, opponent]) {
    for (const code of deckCodes(deck)) {
      const card = cards.get(code);
      if (card === undefined)
        throw new Error(`Missing card type for selected deck code: ${code}`);
      if ((card.type & TYPE_LINK) !== 0) containsLink = true;
    }
  }
  return containsLink ? LINK_PROFILE : LINK_FREE_PROFILE;
}

function deckCodes(deck: ParsedDeck): readonly CardCode[] {
  return [...deck.main, ...deck.extra, ...deck.side];
}
