import type { ParsedDeck } from "../../duel/presets/deck-parser.ts";
import type {
  BotInstance,
  BotGameObservation,
  BotSideboardDecision,
} from "./bot-contract.ts";
import { validateSideboardPair } from "./sideboard.ts";
/** Shared runtime/evaluator transaction. Neither player's proposal reaches the other hook. */
export function sideboardBots(
  original: ParsedDeck,
  bots: readonly [BotInstance, BotInstance],
  histories: readonly [
    readonly [BotGameObservation, BotGameObservation],
    readonly [BotGameObservation, BotGameObservation],
  ],
  validate: (deck: ParsedDeck) => void,
  onHook?: (
    actor: 0 | 1,
    phase: "start" | "end",
    decision?: BotSideboardDecision,
  ) => void,
): {
  decks: readonly [ParsedDeck, ParsedDeck];
  decisions: readonly [BotSideboardDecision, BotSideboardDecision];
  durations: readonly [number, number];
} {
  const times: number[] = [];
  const decisions = bots.map((bot, i) => {
    onHook?.(i as 0 | 1, "start");
    const start = performance.now();
    const result = bot.sideboard(
      structuredClone({ deck: original, preSideGames: histories[i]! }),
    );
    times.push(performance.now() - start);
    onHook?.(i as 0 | 1, "end", result);
    return structuredClone(result);
  }) as [BotSideboardDecision, BotSideboardDecision];
  const decks = validateSideboardPair(original, decisions, validate);
  return { decks, decisions, durations: [times[0]!, times[1]!] };
}
