import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
import type { BotConfiguration } from "../../src/battle/worker/bot/bot-contract.ts";

/** Bot-owned sidecar; paths are relative to its folder. */
export interface EvaluationSetup {
  schemaVersion: 1;
  deck: string;
  content: string;
  banlist: string;
  profile: "mr3" | "mr5";
  configuration: BotConfiguration;
  /** Package policy, or evaluator-supported builtin/relative TS module. */
  policy?: "basic" | "generalist" | "random";
  module?: string;
  strategy?: string;
  fixtures?: { path: string; identity: string };
}
export interface FrozenBot {
  identity: string;
  kind: "package" | "module";
  configuration: BotConfiguration;
  policy?: string;
  module?: string;
  deck: ParsedDeck;
  /** Archive-relative files, never live source references. */
  files: Record<string, string>;
}
export interface GameFixture {
  number: number;
  stage: "pre_side" | "post_side";
  starter: "a" | "b";
  engineSeed: string[];
  botSeeds: number[];
  shuffleSeeds: string[];
  /** Post-side orders derive from actual validated decks, not hypothetical swaps. */
  orders: { main: readonly number[]; extra: readonly number[] }[] | null;
}
export interface FrozenSetup {
  schemaVersion: 1;
  identity: string;
  setupSeed: string;
  inputsIdentity: string;
  profile: "mr3" | "mr5";
  protocol: {
    gamesPerMatch: 4;
    sideboardAfterGame: 2;
    preserveSectionSizes: true;
    preserveTotalMultiset: true;
    shuffle: "sha256-counter-fisher-yates-v1";
    openingHand: "first-five-main-cards; normal-engine-first-turn-draw";
    randomness: "engine-u64x4; bot-u32-per-player-per-game; sideboard-u32-per-player";
  };
  target: FrozenBot;
  opponents: FrozenBot[];
  files: Record<string, string>;
  matches: {
    id: string;
    opponentSlot: string;
    sideboardSeeds: number[];
    games: GameFixture[];
  }[];
}
export interface SetupOptions {
  target: string;
  opponents: string[];
  setupSeed: string;
  session: string;
  stop: {
    maxIterations?: number;
    maxGames?: number;
    maxWallMs?: number;
    ownerStop?: true;
  };
  matchWorkers?: number;
  analysisWorkers?: number;
  reuse?: string;
}

/** Standalone validation input; paths resolve relative to the request JSON. */
export interface CandidateValidationRequest {
  schemaVersion: 1;
  fixture: { path: string; identity: string };
  /** Explicit pinned accepted descriptor; never read mutable state during validation. */
  accepted: { path: string; bot: FrozenBot };
  /** Exact archive-shaped tree, including unchanged files. */
  candidate: string;
  /** Fresh evidence directory; existing evidence is never overwritten. */
  output: string;
}
export interface CandidateValidationResult {
  schemaVersion: 1;
  status: "valid" | "invalid";
  fixtureIdentity: string;
  acceptedIdentity: string;
  snapshotIdentity?: string;
  sourceIdentity?: string;
  executableIdentity?: string;
  candidate?: { path: string; bot: FrozenBot };
  reasons: {
    category: "input" | "scope" | "build" | "check";
    message: string;
  }[];
  evidence: string;
}
