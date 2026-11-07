/** Shapes of the repository-owned experiment artifact and host protocol. */
import type {
  BotDecision,
  BotDecisionInput,
  BotGameObservation,
  BotSideboardDecision,
} from "../../src/battle/worker/bot/bot-contract.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
import type { EngineCardData } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
export interface HostMessage {
  type: string;
  actor: 0 | 1;
  input: BotDecisionInput;
  decision: BotDecision;
  initial: unknown;
  entry: unknown;
  winner: 0 | 1 | null;
  engine_reason: string;
  turns: number;
  manifest: { snapshotId: string };
  decks: ParsedDeck[];
  decisions: BotSideboardDecision[];
}
export interface EvidenceRecord {
  type: "metadata" | "ready" | "game" | "sideboarding";
  policy: "basic" | "generalist";
  match: number;
  game: number;
  content: { snapshotId: string };
  cards: [number, EngineCardData][];
  request: {
    game_id: string;
    bot_order: [0 | 1, 0 | 1];
    decks: [ParsedDeck, ParsedDeck];
    histories: [
      readonly [BotGameObservation, BotGameObservation],
      readonly [BotGameObservation, BotGameObservation],
    ];
  };
  messages: HostMessage[];
}
export interface WireResponse extends BotDecision, BotSideboardDecision {
  contractVersion: number;
  randomDraws: number[];
}
