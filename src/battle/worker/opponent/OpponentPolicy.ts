import type { BotObservedEvent } from "../bot/observed-events.ts";
import { permittedState } from "../bot/actor-observation.ts";
import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type {
  DuelPhase,
  PlayerIndex,
  PublicDuelState,
} from "../../duel/contracts/public-duel-state.ts";

export type OpponentDecisionReason =
  | "summon_first_legal"
  | "special_summon_first_legal"
  | "activate_first_legal"
  | "set_first_legal"
  | "attack_strongest"
  | "advance_phase"
  | "decline_optional"
  | "answer_mandatory"
  | "select_first_legal"
  | "select_valid_sum"
  | "preserve_order"
  | "break_loop_alternative"
  | "break_loop_exit";

export interface OpponentDecision {
  readonly choiceIds: readonly ChoiceId[];
  readonly reason: string;
  readonly explanation?: string;
}

export interface OpponentVisiblePlayerSummary {
  readonly player: PlayerIndex;
  readonly lifePoints: number;
  readonly deckCount: number;
  readonly extraDeckCount: number;
  readonly handCount: number;
  readonly monsterCount: number;
  readonly spellTrapCount: number;
  readonly graveyardCount: number;
  readonly banishedCount: number;
}

/**
 * Actor-relative public state and count summaries. Concealed opponent codes
 * are removed before this contract reaches a bot; legitimate reveals remain.
 */
export interface OpponentVisibleDuelState {
  /** Permitted public events since this actor's preceding decision; no private opponent prompts. */
  readonly events?: readonly BotObservedEvent[];
  readonly publicState?: PublicDuelState;
  readonly revision: number;
  readonly turn: number;
  readonly turnPlayer: PlayerIndex;
  readonly phase: DuelPhase;
  readonly players: readonly [
    OpponentVisiblePlayerSummary,
    OpponentVisiblePlayerSummary,
  ];
  readonly chainSize: number;
}

export interface OpponentPolicy {
  choose(
    prompt: PlayerPrompt,
    visibleState: OpponentVisibleDuelState,
  ): OpponentDecision;
}

export function toOpponentVisibleState(
  state: PublicDuelState,
  actor: PlayerIndex = 1,
  events: readonly BotObservedEvent[] = [],
): OpponentVisibleDuelState {
  return Object.freeze({
    publicState: permittedState(state, actor),
    events,
    revision: state.revision,
    turn: state.turn,
    turnPlayer: state.turnPlayer,
    phase: state.phase,
    players: Object.freeze(
      state.players.map((player) =>
        Object.freeze({
          player: player.player,
          lifePoints: player.lifePoints,
          deckCount: player.deckCount,
          extraDeckCount: player.extraDeckCount,
          handCount: player.handCount,
          monsterCount: player.monsters.length,
          spellTrapCount: player.spellsAndTraps.length,
          graveyardCount: player.graveyard.length,
          banishedCount: player.banished.length,
        }),
      ) as [OpponentVisiblePlayerSummary, OpponentVisiblePlayerSummary],
    ),
    chainSize: state.chain.length,
  });
}

export { BasicOpponentPolicy } from "../../../../assets/ai-bots/basic/ai/tactics/selection.ts";
