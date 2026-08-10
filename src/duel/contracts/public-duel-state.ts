import type { CardCode, CardInstanceId, SnapshotId } from "./ids.ts";

export type PlayerIndex = 0 | 1;
export type DuelPhase =
  | "draw"
  | "standby"
  | "main1"
  | "battleStart"
  | "battleStep"
  | "damage"
  | "damageCalculation"
  | "battle"
  | "main2"
  | "end"
  | "unknown";
export type CardPosition =
  "faceUpAttack" | "faceDownAttack" | "faceUpDefense" | "faceDownDefense";
export type PublicLocation =
  | "deck"
  | "hand"
  | "monster"
  | "spellTrap"
  | "field"
  | "graveyard"
  | "banished"
  | "extra";

export interface PublicOverlayMaterial {
  readonly instanceId: CardInstanceId;
  readonly code: CardCode;
  readonly identityVisible: boolean;
  readonly sequence: number;
}

export interface PublicCounter {
  readonly type: number;
  readonly name: string;
  readonly count: number;
}

export interface PublicCard {
  readonly instanceId: CardInstanceId;
  readonly code?: CardCode;
  readonly owner: PlayerIndex;
  readonly controller: PlayerIndex;
  readonly location: PublicLocation;
  readonly sequence: number;
  readonly position: CardPosition;
  readonly faceUp: boolean;
  readonly counters: readonly PublicCounter[];
  readonly overlayMaterials: readonly PublicOverlayMaterial[];
}

export interface PublicPlayerState {
  readonly player: PlayerIndex;
  readonly lifePoints: number;
  readonly deckCount: number;
  readonly deck: readonly PublicCard[];
  readonly extraDeckCount: number;
  readonly handCount: number;
  readonly hand: readonly PublicCard[];
  readonly extraDeck: readonly PublicCard[];
  readonly monsters: readonly PublicCard[];
  readonly spellsAndTraps: readonly PublicCard[];
  readonly graveyard: readonly PublicCard[];
  readonly banished: readonly PublicCard[];
}

export type PublicChainPhase = "pending" | "solving" | "solved";
export type PublicChainOutcome = "normal" | "negated" | "disabled";

export interface PublicChainLink {
  readonly index: number;
  readonly controller: PlayerIndex;
  readonly sourceIdentityVisible: boolean;
  readonly sourceInstanceId?: CardInstanceId;
  readonly sourceCard?: CardCode;
  readonly label: string;
  readonly description?: string;
  readonly phase: PublicChainPhase;
  readonly outcome: PublicChainOutcome;
}

export interface PublicDuelState {
  readonly snapshotId: SnapshotId;
  readonly revision: number;
  readonly turn: number;
  readonly turnPlayer: PlayerIndex;
  readonly phase: DuelPhase;
  readonly players: readonly [PublicPlayerState, PublicPlayerState];
  readonly chain: readonly PublicChainLink[];
}
