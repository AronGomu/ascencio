import { describe, expect, it } from "vitest";
import {
  cardInstanceId,
  choiceId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { PromptChoice } from "../../src/battle/duel/contracts/player-prompt.ts";
import { resolvePromptChoiceBoardTarget } from "../../src/battle/field/card-mapping.ts";
import { mapSnapshotToBoard } from "../../src/battle/field/board-view-model.ts";
import { BOARD_VIEW_MODEL_FIXTURES } from "../fixtures/board-view-model.ts";

const SNAPSHOT = BOARD_VIEW_MODEL_FIXTURES["ST-08"];
const BOARD_RESULT = mapSnapshotToBoard(SNAPSHOT);
if (!BOARD_RESULT.ok)
  throw new Error("Expected valid interaction board fixture");
const BOARD = BOARD_RESULT.value;

function stackCardChoice(
  location: "deck" | "extra" | "graveyard" | "banished",
  controller: 0 | 1,
): PromptChoice {
  return {
    id: choiceId("stack-choice"),
    label: "Activate",
    action: "activate",
    card: {
      instanceId: cardInstanceId("stack-choice-card"),
      controller,
      location,
      sequence: 0,
      position: "faceUpAttack",
    },
  };
}

describe("resolvePromptChoiceBoardTarget", () => {
  it("resolves a graveyard card to its stack", () => {
    const resolution = resolvePromptChoiceBoardTarget(
      stackCardChoice("graveyard", 0),
      SNAPSHOT,
      BOARD,
    );

    expect(resolution).toEqual({
      kind: "stack",
      targetId: "stack:p0:graveyard",
    });
  });

  it("resolves a banished card to its stack", () => {
    const resolution = resolvePromptChoiceBoardTarget(
      stackCardChoice("banished", 1),
      SNAPSHOT,
      BOARD,
    );

    expect(resolution).toEqual({
      kind: "stack",
      targetId: "stack:p1:banished",
    });
  });

  it("resolves an extra-deck card to its stack", () => {
    const resolution = resolvePromptChoiceBoardTarget(
      stackCardChoice("extra", 0),
      SNAPSHOT,
      BOARD,
    );

    expect(resolution).toEqual({ kind: "stack", targetId: "stack:p0:extra" });
  });

  it("resolves a deck card to its stack", () => {
    const resolution = resolvePromptChoiceBoardTarget(
      stackCardChoice("deck", 0),
      SNAPSHOT,
      BOARD,
    );

    expect(resolution).toEqual({ kind: "stack", targetId: "stack:p0:deck" });
  });

  it("still resolves a hand card to its card target", () => {
    const choice: PromptChoice = {
      id: choiceId("hand-choice"),
      label: "Activate",
      action: "activate",
      card: {
        instanceId: cardInstanceId("st08-chain-source"),
        controller: 0,
        location: "monster",
        sequence: 2,
        position: "faceUpAttack",
      },
    };

    const resolution = resolvePromptChoiceBoardTarget(choice, SNAPSHOT, BOARD);

    expect(resolution).toEqual({
      kind: "board",
      targetId: "card:st08-chain-source",
    });
  });

  it("reports a missing stack as non-field", () => {
    const emptyBoard = { ...BOARD, stacks: [] };

    const resolution = resolvePromptChoiceBoardTarget(
      stackCardChoice("graveyard", 0),
      SNAPSHOT,
      emptyBoard,
    );

    expect(resolution).toEqual({
      kind: "nonField",
      reason: "target_not_mounted",
    });
  });
});
