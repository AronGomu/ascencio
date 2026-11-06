import { bindPromptInstances } from "./prompt-instances.ts";
import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import {
  BasicOpponentPolicy,
  type OpponentPolicy,
} from "../opponent/OpponentPolicy.ts";
import type { BotModule, BotInstance } from "./bot-contract.ts";
import { validateBotDecision } from "./validate-bot-decision.ts";

/** Existing policy, shared by runtime and evaluation; no ARO2-2 strength claims. */
export function createBasicBotModule(
  dependencies: ActiveDuelDependencies,
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

/** Both callers use this boundary before PromptRegistry performs engine encoding. */
export function botAsOpponentPolicy(bot: BotInstance): OpponentPolicy {
  return {
    choose(prompt, observation) {
      const decision = bot.decide(
        structuredClone({
          prompt: bindPromptInstances(prompt, observation.publicState),
          observation,
        }),
      );
      validateBotDecision(prompt, decision);
      return {
        choiceIds: [...decision.choiceIds],
        reason: decision.reason.code,
        explanation: decision.reason.explanation,
      };
    },
  };
}

export function createBasicBotPolicy(
  dependencies: ActiveDuelDependencies,
): OpponentPolicy {
  return botAsOpponentPolicy(createBasicBotModule(dependencies).create({}));
}
