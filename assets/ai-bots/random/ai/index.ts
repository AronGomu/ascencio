import type { BotModule } from "../../../../src/battle/worker/bot/bot-contract.ts";
import {
  legalSelection,
  selectionCounts,
  shuffled,
  type RandomSource,
} from "../../../../src/battle/worker/bot/legal-selection.ts";
import { validateBotDecision } from "../../../../src/battle/worker/bot/validate-bot-decision.ts";

/** Injected randomness is for test/diagnostics; production uses fresh Math.random. */
export function createRandomBotModule(
  random: RandomSource = Math.random,
): BotModule {
  return {
    contractVersion: 1,
    create(configuration) {
      if (Object.keys(configuration).length)
        throw new Error("Random bot accepts no configuration keys");
      return {
        decide({ prompt }) {
          const decision = {
            choiceIds: legalSelection(
              prompt,
              shuffled(prompt.choices, random),
              shuffled(selectionCounts(prompt), random),
              random,
            ),
            reason: {
              code: "random_legal_response",
              explanation:
                "Randomized legal choices, selection count, order and allocations without strategic scoring.",
            },
          };
          validateBotDecision(prompt, decision);
          return decision;
        },
        sideboard() {
          return {
            exchanges: [],
            reason: {
              code: "retain_deck",
              explanation: "Keep the declared comparison deck unchanged.",
            },
          };
        },
      };
    },
  };
}
export default createRandomBotModule();

export const createBotModule = () => createRandomBotModule();
