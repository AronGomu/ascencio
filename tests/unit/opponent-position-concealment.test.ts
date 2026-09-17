import { describe, expect, it } from "vitest";
import { snapshotId } from "../../src/battle/duel/contracts/ids.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePosition,
} from "../../src/battle/worker/engine/engine-constants.ts";
import { DuelStateProjector } from "../../src/battle/worker/projection/DuelStateProjector.ts";

describe("opponent position concealment", () => {
  it("redacts a public banished card when it turns face-down", () => {
    const projector = new DuelStateProjector(
      snapshotId("a".repeat(64)),
      [40, 40],
      [0, 0],
      { extraMonsterZones: true },
    );
    projector.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 39,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.BANISHED,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const publicCard = projector.snapshot().players[1].banished[0];

    projector.apply({
      type: EngineMessageType.POSITION_CHANGE,
      code: 5053103,
      controller: 1,
      location: EngineLocation.BANISHED,
      sequence: 0,
      prev_position: EnginePosition.FACE_UP_ATTACK,
      position: EnginePosition.FACE_DOWN_DEFENSE,
    });

    const concealedCard = projector.snapshot().players[1].banished[0];
    expect(concealedCard).not.toHaveProperty("code");
    expect(concealedCard?.instanceId).not.toBe(publicCard?.instanceId);
    expect(concealedCard).toMatchObject({
      faceUp: false,
      position: "faceDownDefense",
    });
  });
});
