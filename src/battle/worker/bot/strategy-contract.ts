import type { PromptChoice } from "../../duel/contracts/player-prompt.ts";
import type { BotDecisionInput, BotReason } from "./bot-contract.ts";
export interface ChoiceScore extends BotReason {
  readonly score: number;
}
/** Bot-owned scoring; response construction and validation stay in the shared runtime. */
export type GeneralistStrategy = (
  input: BotDecisionInput,
  choice: PromptChoice,
) => ChoiceScore;
