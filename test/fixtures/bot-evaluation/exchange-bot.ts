import { createBasicBotModule } from "../../../src/battle/worker/bot/basic-bot.ts";
import type { BotModule } from "../../../src/battle/worker/bot/bot-contract.ts";
import type { ActiveDuelDependencies } from "../../../src/battle/worker/assets/active-duel-dependencies.ts";
/** Test policy uses shared legal play without attack-ranking metadata. Engine remains real. */
const bot: BotModule = {
  contractVersion: 1,
  create() {
    const metadata: ActiveDuelDependencies = {
      cards: new Map(),
      texts: new Map(),
      scripts: new Map(),
      strings: { system: {}, victory: {}, counter: {}, setname: {} },
      images: new Map(),
      counts: { cards: 0, texts: 0, scripts: 0, globals: 0, images: 0 },
    };
    const base = createBasicBotModule(metadata).create({});
    return {
      ...base,
      sideboard(input) {
        if (
          input.preSideGames.length !== 2 ||
          input.preSideGames.some((g) => !g.outcome)
        )
          throw new Error("Missing permitted pre-side history");
        const incoming = input.deck.side[0]!;
        const outgoing = input.deck.main.find((c) => c !== incoming)!;
        const reason = {
          code: "test_legal_exchange",
          explanation:
            "Exchange one owned Side Deck card after inspecting two permitted histories.",
        };
        return {
          reason,
          exchanges: [
            {
              from: "main",
              to: "side",
              cardCode: String(outgoing),
              copies: 1,
              reason,
            },
            {
              from: "side",
              to: "main",
              cardCode: String(incoming),
              copies: 1,
              reason,
            },
          ],
        };
      },
    };
  },
};
export default bot;
