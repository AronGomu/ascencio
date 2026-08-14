import {
  cardCode,
  cardInstanceId,
  choiceId,
  promptId,
  snapshotId,
} from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
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
import {
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
} from "../prompts/interaction-spec.ts";
import type { AcceptanceScenarioId } from "./acceptance-scenario.ts";

export interface FullHeightFieldScenario {
  readonly id: AcceptanceScenarioId;
  readonly extraMonsterZones: boolean;
  readonly board: BoardViewModel;
  readonly phaseSpec: ActiveInteractionSpec;
}

export function fullHeightFieldScenario(
  id: AcceptanceScenarioId,
): FullHeightFieldScenario {
  const extraMonsterZones = id !== "field-no-emz";
  const handCount = id === "field-hand-6" ? 6 : id === "field-hand-20" ? 20 : 0;
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
          card("acceptance-set", 97590747, 0, "monster", 3, "faceDownDefense"),
        ]
      : [],
    Array.from({ length: handCount }, (_, sequence) =>
      card(
        `acceptance-hand-${sequence}`,
        97590747,
        0,
        "hand",
        sequence,
        "faceDownDefense",
      ),
    ),
    Array.from({ length: handCount }, (_, sequence) =>
      card(
        `acceptance-opponent-hand-${sequence}`,
        97590747,
        1,
        "hand",
        sequence,
        "faceDownDefense",
      ),
    ),
  );
  const result = mapSnapshotToBoard(snapshot);
  if (!result.ok)
    throw new Error(
      `Acceptance scenario failed board mapping: ${result.error.type}`,
    );
  const phaseSpec = acceptancePhaseSpec(snapshot, result.value);
  return Object.freeze({
    id,
    extraMonsterZones,
    board: result.value,
    phaseSpec,
  });
}

function state(
  id: string,
  extraMonsterZones: boolean,
  monsters: readonly PublicCard[],
  hand: readonly PublicCard[],
  opponentHand: readonly PublicCard[],
): PublicDuelState {
  return {
    snapshotId: snapshotId(id.padEnd(64, "0").slice(0, 64)),
    revision: 1,
    turn: 1,
    turnPlayer: 0,
    phase: "main1",
    layout: { extraMonsterZones },
    players: [player(0, monsters, hand), player(1, [], opponentHand)],
    chain: [],
  };
}

function player(
  playerIndex: PlayerIndex,
  monsters: readonly PublicCard[],
  hand: readonly PublicCard[],
): PublicPlayerState {
  return {
    player: playerIndex,
    lifePoints: 8000,
    deckCount: 0,
    deck: [],
    extraDeckCount: 0,
    handCount: hand.length,
    hand,
    extraDeck: [],
    monsters,
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
  };
}

function acceptancePhaseSpec(
  snapshot: PublicDuelState,
  board: BoardViewModel,
): ActiveInteractionSpec {
  const prompt: PlayerPrompt = {
    id: promptId("acceptance-phase-choices"),
    kind: "idleCommand",
    player: 0,
    title: "Choose a phase",
    choices: [
      {
        id: choiceId("acceptance-battle-phase"),
        label: "Enter Battle Phase",
        action: "battlePhase",
      },
      {
        id: choiceId("acceptance-end-phase"),
        label: "End turn",
        action: "endPhase",
      },
    ],
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
  };
  const spec = mapPromptToInteractionSpec(prompt, snapshot, board, {
    workerGeneration: 1,
    sessionGeneration: 1,
  });
  if (spec.kind === "inactive")
    throw new Error("Acceptance phase choices did not map to field controls");
  return spec;
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
    faceUp: position !== "faceDownDefense",
    counters: [],
    overlayMaterials: [],
  };
}
