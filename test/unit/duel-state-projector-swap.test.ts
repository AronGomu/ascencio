import { describe, expect, it } from "vitest";
import { snapshotId } from "../../src/battle/duel/contracts/ids.ts";
import { DuelStateProjector } from "../../src/battle/worker/projection/DuelStateProjector.ts";
import {
  EngineLocation as L,
  EngineMessageType as M,
  EnginePosition as P,
} from "../../src/battle/worker/engine/engine-constants.ts";
import type { EngineMessage } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";

function fixture(position = P.FACE_UP_ATTACK as number, viewer: 0 | 1 = 0) {
  const projector = new DuelStateProjector(
    snapshotId("a".repeat(64)),
    [40, 40],
    [0, 0],
    { extraMonsterZones: false },
    [[], []],
    undefined,
    viewer,
  );
  const cards = [
    {
      code: 73915052,
      controller: 0 as const,
      location: L.MONSTER,
      sequence: 1,
      position: P.FACE_UP_ATTACK,
    },
    {
      code: 88240808,
      controller: 1 as const,
      location: L.MONSTER,
      sequence: 3,
      position: position as never,
    },
  ];
  for (const card of cards)
    projector.apply({
      type: M.MOVE,
      card: card.code,
      from: { ...card, location: L.DECK },
      to: card,
    });
  return {
    projector,
    cards,
    swap: { type: 55, card1: cards[0], card2: cards[1] } as EngineMessage,
  };
}
describe("engine Swap projection", () => {
  it("moves physical instances and codes atomically across control, retaining each position", () => {
    const { projector, swap } = fixture(P.FACE_UP_DEFENSE);
    const before = projector.snapshot();
    const update = projector.apply(swap);
    const after = projector.snapshot();
    expect(after.players[0].monsters[0]!).toMatchObject({
      instanceId: before.players[1].monsters[0]!.instanceId,
      code: 88240808,
      controller: 0,
      sequence: 1,
      position: "faceUpDefense",
    });
    expect(after.players[1].monsters[0]!).toMatchObject({
      instanceId: before.players[0].monsters[0]!.instanceId,
      code: 73915052,
      controller: 1,
      sequence: 3,
      position: "faceUpAttack",
    });
    expect(update.events).toHaveLength(2);
  });
  it("reveals a concealed incoming card only to its new controller", () => {
    const { projector, swap } = fixture(P.FACE_DOWN_DEFENSE);
    expect(projector.snapshot().players[1].monsters[0]!.code).toBeUndefined();
    projector.apply(swap);
    expect(projector.snapshot().players[0].monsters[0]!.code).toBe(88240808);
  });
  it("does not publish the raw code of a face-down card transferred away", () => {
    const { projector, swap } = fixture(P.FACE_DOWN_DEFENSE, 1);
    const original = projector.snapshot().players[1].monsters[0]!;
    expect(original.code).toBe(88240808);
    const update = projector.apply(swap);
    const outgoing = projector.snapshot().players[0].monsters[0]!;
    expect(outgoing.instanceId).toBe(original.instanceId);
    expect(outgoing.code).toBeUndefined();
    expect(update.events[1]).not.toHaveProperty("card");
  });
  it("preserves counters on the transferred physical card", () => {
    const { projector, cards, swap } = fixture();
    projector.apply({
      type: M.ADD_COUNTER,
      ...cards[0],
      counter_type: 1,
      count: 2,
    } as EngineMessage);
    const before = projector.snapshot().players[0].monsters[0]!.counters;
    expect(before).toHaveLength(1);
    projector.apply(swap);
    expect(projector.snapshot().players[1].monsters[0]!.counters).toEqual(
      before,
    );
  });
  it("rejects absent slots without partially moving either card", () => {
    const { projector, cards } = fixture();
    const before = projector.snapshot();
    expect(() =>
      projector.apply({
        type: 55,
        card1: cards[0],
        card2: { ...cards[1], sequence: 4 },
      } as EngineMessage),
    ).toThrow();
    expect(projector.snapshot()).toEqual(before);
  });
});
