import type { ActiveDuelDependencies } from "../../../../src/battle/worker/assets/active-duel-dependencies.ts";
import { BasicOpponentPolicy } from "./tactics/selection.ts";
import type { BotModule } from "../../../../src/battle/worker/bot/bot-contract.ts";

/** Existing policy, shared by runtime and evaluation; no ARO2-2 strength claims. */
export function createBasicBotModule(
  dependencies: Pick<ActiveDuelDependencies, "cards">,
): BotModule {
  return {
    contractVersion: 1,
    create(configuration) {
      if (Object.keys(configuration).length !== 0)
        throw new Error("Basic bot accepts no configuration keys");
      const policy = new BasicOpponentPolicy(dependencies);
      return {
        decide({ prompt, observation }) {
          const decision = policy.choose(prompt, observation);
          return {
            choiceIds: decision.choiceIds,
            reason: {
              code: decision.reason,
              explanation: `Basic policy selected ${decision.choiceIds.length} choice(s) using ${decision.reason.replaceAll("_", " ")}.`,
            },
          };
        },
        sideboard() {
          return {
            exchanges: [],
            reason: {
              code: "retain_configuration",
              explanation:
                "The basic policy retains the validated input deck without exchanges.",
            },
          };
        },
      };
    },
  };
}

export { createBasicBotModule as createBotModule };
