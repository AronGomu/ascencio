import { cardCode, cardInstanceId, snapshotId } from "../../duel/contracts/ids.ts";
import type {
  PlayerIndex,
  PublicCard,
  PublicDuelState,
  PublicPlayerState,
} from "../../duel/contracts/public-duel-state.ts";
import {
  mapSnapshotToBoard,
  type BoardViewModel,
} from "../../field/board-view-model.ts";
import type { AcceptanceScenarioId } from "./acceptance-scenario.ts";

export interface FullHeightFieldScenario {
  readonly id: AcceptanceScenarioId;
  readonly extraMonsterZones: boolean;
  readonly board: BoardViewModel;
}

export function fullHeightFieldScenario(
  id: AcceptanceScenarioId,
): FullHeightFieldScenario {
  const extraMonsterZones = id !== "field-no-emz";
  const snapshot = state(
    id,
    extraMonsterZones,
    id === "field-defense"
      ? [
          card(
            "acceptance-defense",
            46986414,
            0,
            "monster",
            2,
            "faceUpDefense",
          ),
        ]
      : [],
  );
  const result = mapSnapshotToBoard(snapshot);
  if (!result.ok)
    throw new Error(`Acceptance scenario failed board mapping: ${result.error.type}`);
  return Object.freeze({ id, extraMonsterZones, board: result.value });
}

function state(
  id: string,
  extraMonsterZones: boolean,
  monsters: readonly PublicCard[],
): PublicDuelState {
  return {
    snapshotId: snapshotId(id.padEnd(64, "0").slice(0, 64)),
    revision: 1,
    turn: 1,
    turnPlayer: 0,
    phase: "main1",
    layout: { extraMonsterZones },
    players: [player(0, monsters), player(1, [])],
    chain: [],
  };
}

function player(
  playerIndex: PlayerIndex,
  monsters: readonly PublicCard[],
): PublicPlayerState {
  return {
    player: playerIndex,
    lifePoints: 8000,
    deckCount: 0,
    deck: [],
    extraDeckCount: 0,
    handCount: 0,
    hand: [],
    extraDeck: [],
    monsters,
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
  };
}

function card(
  id: string,
  code: number,
  controller: PlayerIndex,
  location: PublicCard["location"],
  sequence: number,
  position: PublicCard["position"],
): PublicCard {
  return {
    instanceId: cardInstanceId(id),
    code: cardCode(code),
    owner: controller,
    controller,
    location,
    sequence,
    position,
    faceUp: true,
    counters: [],
    overlayMaterials: [],
  };
}
