import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type { ParsedDeck } from "../../duel/presets/deck-parser.ts";
import type { OpponentVisibleDuelState } from "../opponent/OpponentPolicy.ts";

/** Serializable configuration only; a factory creates fresh game-local state. */
export type BotConfiguration = Readonly<
  Record<string, string | number | boolean>
>;
export interface BotReason {
  readonly code: string;
  readonly explanation: string;
}
export interface BotDecision {
  readonly choiceIds: readonly ChoiceId[];
  readonly reason: BotReason;
}
export interface BotDecisionInput {
  readonly prompt: PlayerPrompt;
  readonly observation: OpponentVisibleDuelState;
}
export type DeckSection = "main" | "extra" | "side";
export interface SideboardExchange {
  readonly from: DeckSection;
  readonly to: DeckSection;
  readonly cardCode: string;
  readonly copies: number;
  readonly reason: BotReason;
}
/** Caller supplies only this actor's records, never the other report. */
export interface BotGameObservation {
  /** Chronological permitted event/decision evidence, excluding own future deck order. */
  readonly events?: readonly unknown[];
  readonly initial?: unknown;
  readonly outcome?: "win" | "loss" | "draw";
  readonly gameId: string;
  readonly decisions: readonly (BotDecisionInput & {
    readonly decision: BotDecision;
  })[];
}
export interface BotSideboardInput {
  readonly deck: ParsedDeck;
  readonly preSideGames: readonly [BotGameObservation, BotGameObservation];
}
export interface BotSideboardDecision {
  readonly exchanges: readonly SideboardExchange[];
  readonly reason: BotReason;
}
export interface BotInstance {
  decide(input: BotDecisionInput): BotDecision;
  sideboard(input: BotSideboardInput): BotSideboardDecision;
}
export interface BotModule {
  readonly contractVersion: 1;
  create(configuration: BotConfiguration): BotInstance;
}
