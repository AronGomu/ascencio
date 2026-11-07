import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type {
  OpponentDecision,
  OpponentVisibleDuelState,
} from "./OpponentPolicy.ts";
export interface AsyncOpponentPolicy {
  choose(
    prompt: PlayerPrompt,
    state: OpponentVisibleDuelState,
  ): Promise<OpponentDecision>;
  dispose(): void;
}
export interface OpponentRequest {
  readonly prompt: PlayerPrompt;
  readonly state: OpponentVisibleDuelState;
}
