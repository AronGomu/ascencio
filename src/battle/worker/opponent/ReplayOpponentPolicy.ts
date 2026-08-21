import type { ChoiceId, PromptId } from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type {
  OpponentDecision,
  OpponentDecisionReason,
  OpponentPolicy,
  OpponentVisibleDuelState,
} from "./OpponentPolicy.ts";

/** One answer the opponent already gave, read back off the duel's trace. */
export interface RecordedOpponentResponse {
  readonly promptId: PromptId;
  readonly choiceIds: readonly ChoiceId[];
  readonly reason: OpponentDecisionReason;
}

/** A rebuilt duel that asked a different question than the one the recorded
    answer belongs to. Replaying past this point would produce a position the
    player never played, so the replay stops here instead. */
export class ReplayDivergenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayDivergenceError";
  }
}

/**
 * Answers the opponent's seat from its own recorded answers while a duel is
 * being rebuilt, and hands the seat back to `resumeWith` the moment the record
 * runs out.
 *
 * Deciding a recorded prompt again would be enough to lose the position: the
 * policy is free to answer differently once the loop breaker has seen a
 * repeat, and one different answer makes every later message a different duel.
 */
export class ReplayOpponentPolicy implements OpponentPolicy {
  readonly #recorded: readonly RecordedOpponentResponse[];
  readonly #resumeWith: OpponentPolicy;
  #next = 0;

  constructor(
    recorded: readonly RecordedOpponentResponse[],
    resumeWith: OpponentPolicy,
  ) {
    this.#recorded = Object.freeze([...recorded]);
    this.#resumeWith = resumeWith;
  }

  choose(
    prompt: PlayerPrompt,
    visibleState: OpponentVisibleDuelState,
  ): OpponentDecision {
    const recorded = this.#recorded[this.#next];
    if (recorded === undefined)
      return this.#resumeWith.choose(prompt, visibleState);
    if (recorded.promptId !== prompt.id) {
      throw new ReplayDivergenceError(
        `Replay expected the opponent to answer ${recorded.promptId} but the rebuilt duel asked ${prompt.id}`,
      );
    }
    this.#next += 1;
    return { choiceIds: recorded.choiceIds, reason: recorded.reason };
  }

  /** How many recorded answers the replay has still to feed back. */
  get pending(): number {
    return this.#recorded.length - this.#next;
  }
}
