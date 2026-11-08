import type { ActiveDuelDependencies } from "../../../../src/battle/worker/assets/active-duel-dependencies.ts";
import type { GeneralistStrategy } from "../../../../src/battle/worker/bot/strategy-contract.ts";
import type { GeneralistSelectionStrategy } from "../../../../src/battle/worker/bot/generalist-selection-strategy.ts";
import { createStrategyBotModule } from "../../../../src/battle/worker/bot/strategy-bot.ts";
import { baselineStrategy } from "./evaluation/scoring.ts";
export const createGeneralistBotModule = (
  dependencies: Pick<ActiveDuelDependencies, "cards">,
  strategy: GeneralistStrategy = baselineStrategy(dependencies),
  preferCounts?: GeneralistSelectionStrategy,
) => createStrategyBotModule(dependencies, strategy, preferCounts);
export { createGeneralistBotModule as createBotModule };
