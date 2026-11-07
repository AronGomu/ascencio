import { describe, expect, it } from "vitest";
import { parseDuelWorkerEvent } from "../../src/battle/duel/contracts/duel-worker-event.ts";
import { snapshotId } from "../../src/battle/duel/contracts/ids.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePosition,
} from "../../src/battle/worker/engine/engine-constants.ts";
import { DuelStateProjector } from "../../src/battle/worker/projection/DuelStateProjector.ts";

const CODES = [97590747, 5053103, 46986414] as const;

function projector(deckCounts: readonly [number, number] = [40, 40]) {
  return new DuelStateProjector(
    snapshotId("deck-order-projection"),
    deckCounts,
    [0, 0],
    { extraMonsterZones: true },
  );
}

function confirmTop(
  value: DuelStateProjector,
  player: 0 | 1 = 0,
  codes: readonly number[] = CODES,
) {
  return value.apply({
    type: EngineMessageType.CONFIRM_DECKTOP,
    player,
    cards: codes.map((code, sequence) => ({
      code,
      controller: player,
      location: EngineLocation.DECK,
      sequence,
    })),
  });
}

function drawn(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    code: 10_000_000 + index,
    position: EnginePosition.FACE_DOWN_DEFENSE,
  }));
}

function expectHiddenDeck(value: DuelStateProjector, player: 0 | 1 = 0) {
  for (const slot of value.snapshot().players[player].deck) {
    expect(slot).not.toHaveProperty("code");
    expect(slot.faceUp).toBe(false);
    expect(slot.position).toBe("faceDownAttack");
  }
}

describe("projected deck order", () => {
  it("projects one deck slot per remaining card", () => {
    const deck = projector().snapshot().players[0].deck;

    expect(deck).toHaveLength(40);
    deck.forEach((slot, index) => {
      expect(slot).toMatchObject({
        instanceId: `deck-p0-${index}`,
        owner: 0,
        controller: 0,
        location: "deck",
        sequence: index,
        position: "faceDownAttack",
        faceUp: false,
        counters: [],
        overlayMaterials: [],
      });
      expect(slot).not.toHaveProperty("code");
    });
  });

  it("reveals the excavated top cards", () => {
    const value = projector();
    const update = confirmTop(value);
    const deck = value.snapshot().players[0].deck;

    expect(update.events).toEqual([]);
    expect(update.reconciliationRequests).toEqual([]);
    expect(deck.slice(0, 3).map((slot) => slot.code)).toEqual(CODES);
    for (const slot of deck.slice(0, 3)) {
      expect(slot.faceUp).toBe(true);
      expect(slot.position).toBe("faceUpAttack");
    }
    expect(deck[3]).not.toHaveProperty("code");
    expect(deck[3]).toMatchObject({
      faceUp: false,
      position: "faceDownAttack",
    });
  });

  it("skips a confirm whose cards are not all in that deck", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.CONFIRM_DECKTOP,
      player: 0,
      cards: [
        {
          code: CODES[0],
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 0,
        },
        {
          code: CODES[1],
          controller: 1,
          location: EngineLocation.DECK,
          sequence: 1,
        },
      ],
    });

    expectHiddenDeck(value);
  });

  it("reveals a single deck position", () => {
    const value = projector();
    const update = value.apply({
      type: EngineMessageType.DECK_TOP,
      player: 0,
      count: 2,
      code: CODES[0],
      position: EnginePosition.FACE_UP_ATTACK,
    });
    const deck = value.snapshot().players[0].deck;

    expect(update.events).toEqual([]);
    expect(update.reconciliationRequests).toEqual([]);
    expect(deck[0]).not.toHaveProperty("code");
    expect(deck[1]).not.toHaveProperty("code");
    expect(deck[2]).toMatchObject({
      code: CODES[0],
      faceUp: true,
      position: "faceUpAttack",
    });
  });

  it("ignores a deck-top with no code", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.DECK_TOP,
      player: 0,
      count: 2,
      code: 0,
      position: EnginePosition.FACE_UP_ATTACK,
    });

    expectHiddenDeck(value);
  });

  it("shifts reveals down on draw", () => {
    const value = projector();
    confirmTop(value);
    value.apply({
      type: EngineMessageType.DRAW,
      player: 0,
      drawn: drawn(1),
    });

    const deck = value.snapshot().players[0].deck;
    expect(deck).toHaveLength(39);
    expect(deck[0]?.code).toBe(CODES[1]);
    expect(deck[1]?.code).toBe(CODES[2]);
    expect(deck[2]).not.toHaveProperty("code");
  });

  it("forgets everything on shuffle", () => {
    const value = projector();
    confirmTop(value);
    value.apply({ type: EngineMessageType.SHUFFLE_DECK, player: 0 });

    expectHiddenDeck(value);
  });

  it("forgets everything when a card moves from or to the deck", () => {
    const value = projector();
    confirmTop(value);
    value.apply({
      type: EngineMessageType.MOVE,
      card: CODES[0],
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(value.snapshot().players[0].deck).toHaveLength(39);
    expectHiddenDeck(value);

    confirmTop(value);
    value.apply({
      type: EngineMessageType.MOVE,
      card: CODES[0],
      from: {
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    expect(value.snapshot().players[0].deck).toHaveLength(40);
    expectHiddenDeck(value);
  });

  it("forgets everything on swap-grave-deck", () => {
    const value = projector();
    confirmTop(value);
    value.apply({
      type: EngineMessageType.SWAP_GRAVE_DECK,
      player: 0,
      deck_size: 40,
      returned_to_extra: [],
    });

    expectHiddenDeck(value);
  });

  it("forgets both players' reveals on reverse-deck", () => {
    const value = projector();
    confirmTop(value, 0);
    confirmTop(value, 1);
    value.apply({ type: EngineMessageType.REVERSE_DECK });

    expectHiddenDeck(value, 0);
    expectHiddenDeck(value, 1);
  });

  it("never leaks the opponent deck", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.DECK_TOP,
      player: 1,
      count: 2,
      code: CODES[0],
      position: EnginePosition.FACE_UP_ATTACK,
    });
    const snapshot = value.snapshot();

    expect(snapshot.players[1].deck[2]).toMatchObject({
      code: CODES[0],
      faceUp: true,
      position: "faceUpAttack",
    });
    expect(() =>
      parseDuelWorkerEvent({ type: "state", state: snapshot }),
    ).not.toThrow();
  });

  it("truncates reveals past the deck size", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.DECK_TOP,
      player: 0,
      count: 5,
      code: CODES[0],
      position: EnginePosition.FACE_UP_ATTACK,
    });
    value.apply({
      type: EngineMessageType.DRAW,
      player: 0,
      drawn: drawn(37),
    });

    expect(value.snapshot().players[0].deck).toHaveLength(3);
    expectHiddenDeck(value);
  });
});
