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
  /** Identity known to local viewer, independent of current face orientation. */
  readonly code?: CardCode;
  readonly owner: PlayerIndex;
  readonly controller: PlayerIndex;
  readonly location: PublicLocation;
  readonly sequence: number;
  /**
   * Arrival rank inside the owner's hand, present on hand cards only. Two
   * orders exist per hand: `sequence` addresses the engine, `displayOrder`
   * addresses the eye, so an engine shuffle never moves the hand a player is
   * looking at (ADR-047). Never part of a choice payload.
   */
  readonly displayOrder?: number;
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

/** A card the open chain link named as a target. Carries the address the local
    viewer may already see and withholds the code otherwise, so a face-down
    target reads as one without naming it. */
export interface PublicChainTarget {
  readonly identityVisible: boolean;
  readonly controller: PlayerIndex;
  readonly location: PublicLocation;
  readonly instanceId?: CardInstanceId;
  readonly card?: CardCode;
}

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
  readonly targets?: readonly PublicChainTarget[];
}

/** Immutable geometry chosen with the duel's engine rules profile. */
export interface PublicDuelLayout {
  readonly extraMonsterZones: boolean;
}

export interface PublicDuelState {
  readonly snapshotId: SnapshotId;
  readonly revision: number;
  readonly turn: number;
  readonly turnPlayer: PlayerIndex;
  readonly phase: DuelPhase;
  readonly layout: PublicDuelLayout;
  readonly players: readonly [PublicPlayerState, PublicPlayerState];
  readonly chain: readonly PublicChainLink[];
}
