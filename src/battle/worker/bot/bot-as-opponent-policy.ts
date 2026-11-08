import { bindPromptInstances } from "./prompt-instances.ts";
import type { BotInstance } from "./bot-contract.ts";
import type { OpponentPolicy } from "../opponent/OpponentPolicy.ts";
import { validateBotDecision } from "./validate-bot-decision.ts";

/** Both callers use this boundary before PromptRegistry performs engine encoding. */
export function botAsOpponentPolicy(
  bot: BotInstance,
  cloneInput = true,
): OpponentPolicy {
  return {
    choose(prompt, observation) {
      const input = {
        prompt: bindPromptInstances(prompt, observation.publicState),
        observation,
      };
      const decision = bot.decide(cloneInput ? structuredClone(input) : input);
      validateBotDecision(prompt, decision);
      return {
        choiceIds: [...decision.choiceIds],
        reason: decision.reason.code,
        explanation: decision.reason.explanation,
      };
    },
  };
}
