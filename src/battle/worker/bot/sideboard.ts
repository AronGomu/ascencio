import { cardCode } from "../../duel/contracts/ids.ts";
import type { ParsedDeck } from "../../duel/presets/deck-parser.ts";
import type {
  BotSideboardDecision,
  DeckSection,
  SideboardExchange,
} from "./bot-contract.ts";
import { validateBotReason } from "./validate-bot-decision.ts";

const sections: readonly DeckSection[] = ["main", "extra", "side"];

/** Apply simultaneously: incoming cards cannot finance another outgoing exchange. */
export function validateSideboard(
  original: ParsedDeck,
  decision: BotSideboardDecision,
  validateLegality: (deck: ParsedDeck) => void,
): ParsedDeck {
  validateBotReason(decision?.reason);
  if (!Array.isArray(decision.exchanges))
    throw new Error("Invalid sideboard exchanges");
  const remaining = {
    main: [...original.main],
    extra: [...original.extra],
    side: [...original.side],
  };
  const incoming: Record<DeckSection, number[]> = {
    main: [],
    extra: [],
    side: [],
  };
  for (const exchange of decision.exchanges as readonly SideboardExchange[]) {
    validateBotReason(exchange.reason);
    if (
      !sections.includes(exchange.from) ||
      !sections.includes(exchange.to) ||
      exchange.from === exchange.to ||
      (exchange.from !== "side" && exchange.to !== "side") ||
      typeof exchange.cardCode !== "string" ||
      !/^[1-9][0-9]*$/.test(exchange.cardCode) ||
      !Number.isSafeInteger(Number(exchange.cardCode)) ||
      !Number.isSafeInteger(exchange.copies) ||
      exchange.copies <= 0 ||
      exchange.copies > 3
    ) {
      throw new Error("Invalid sideboard exchange");
    }
    for (let copy = 0; copy < exchange.copies; copy++) {
      const code = cardCode(Number(exchange.cardCode));
      const index = remaining[exchange.from].indexOf(code);
      if (index < 0)
        throw new Error("Sideboard exchange spends an unavailable card");
      remaining[exchange.from].splice(index, 1);
      incoming[exchange.to].push(code);
    }
  }
  const result = Object.freeze({
    main: Object.freeze([...remaining.main, ...incoming.main.map(cardCode)]),
    extra: Object.freeze([...remaining.extra, ...incoming.extra.map(cardCode)]),
    side: Object.freeze([...remaining.side, ...incoming.side.map(cardCode)]),
  });
  for (const section of sections) {
    if (result[section].length !== original[section].length)
      throw new Error("Sideboarding changes section sizes");
  }
  validateLegality(result);
  return result;
}

/** Neither configuration escapes until both submissions pass the same legality rules. */
export function validateSideboardPair(
  original: ParsedDeck,
  decisions: readonly [BotSideboardDecision, BotSideboardDecision],
  validateLegality: (deck: ParsedDeck) => void,
): readonly [ParsedDeck, ParsedDeck] {
  return Object.freeze([
    validateSideboard(original, decisions[0], validateLegality),
    validateSideboard(original, decisions[1], validateLegality),
  ]);
}
