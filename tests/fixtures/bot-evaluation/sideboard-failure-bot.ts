import exchange from "./exchange-bot.ts";
import type { BotModule } from "../../../src/battle/worker/bot/bot-contract.ts";
const bot: BotModule = {
  contractVersion: 1,
  create(config) {
    const base = exchange.create({});
    return {
      ...base,
      sideboard() {
        if (config.hang === "true") {
          for (;;) {
            /* watchdog fixture */
          }
        }
        throw new Error("sideboarding_fixture: intentional hook failure");
      },
    };
  },
};
export default bot;
