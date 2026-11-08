import { botAsOpponentPolicy } from "./bot-as-opponent-policy.ts";
export { botAsOpponentPolicy };
import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import { type OpponentPolicy } from "../opponent/OpponentPolicy.ts";

import { createBasicBotModule } from "../../../../assets/ai-bots/basic/ai/index.ts";
export { createBasicBotModule };

export function createBasicBotPolicy(
  dependencies: ActiveDuelDependencies,
): OpponentPolicy {
  return botAsOpponentPolicy(
    createBasicBotModule(dependencies).create({}),
    false,
  );
}
