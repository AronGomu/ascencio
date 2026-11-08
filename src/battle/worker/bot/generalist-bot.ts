import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import { botAsOpponentPolicy } from "./bot-as-opponent-policy.ts";
import { createGeneralistBotModule } from "../../../../assets/ai-bots/generalist/ai/index.ts";
export { createGeneralistBotModule };
/** Compatibility entry for the built-in policy; the package owns its defaults. */
export function createGeneralistBotPolicy(
  dependencies: ActiveDuelDependencies,
) {
  return botAsOpponentPolicy(
    createGeneralistBotModule(dependencies).create({}),
  );
}
