import type { BotModule } from "../../../src/battle/worker/bot/bot-contract.ts";
import { choiceId } from "../../../src/battle/duel/contracts/ids.ts";
const module: BotModule = {
  contractVersion: 1,
  create() {
    return {
      decide() {
        return {
          choiceIds: [choiceId("not-offered")],
          reason: {
            code: "invalid_fixture",
            explanation: "Intentionally invalid regression fixture.",
          },
        };
      },
      sideboard() {
        return {
          exchanges: [],
          reason: { code: "retain", explanation: "Keep input." },
        };
      },
    };
  },
};
export default module;
