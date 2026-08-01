import { describe, expect, it } from "vitest";
import { parseDuelWorkerEvent } from "../../src/duel/contracts/duel-worker-event.ts";
import { cardCode, snapshotId } from "../../src/duel/contracts/ids.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePosition,
} from "../../src/worker/engine/engine-constants.ts";
import { DuelStateProjector } from "../../src/worker/projection/DuelStateProjector.ts";

function projector(): DuelStateProjector {
  return new DuelStateProjector(snapshotId("a".repeat(64)), [40, 40], [0, 0]);
}

function queriedExtra(code: number) {
  return {
    code,
    owner: 0 as const,
    position: EnginePosition.FACE_DOWN_DEFENSE,
    isPublic: false,
    isHidden: true,
  };
}

function queriedCard(code: number) {
  return { code, identityVisible: true };
}

describe("DuelStateProjector", () => {
  it("projects human hand identities but strips opponent hidden identities", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.DRAW,
      player: 0,
      drawn: [{ code: 97590747, position: EnginePosition.FACE_DOWN_DEFENSE }],
    });
    value.apply({
      type: EngineMessageType.DRAW,
      player: 1,
      drawn: [{ code: 5053103, position: EnginePosition.FACE_DOWN_DEFENSE }],
    });

    const snapshot = value.snapshot();
    expect(snapshot.players[0].hand[0]?.code).toBe(97590747);
    expect(snapshot.players[1].handCount).toBe(1);
    expect(snapshot.players[1].hand).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain("5053103");
  });

  it("redacts opponent face-down identities from presentation events", () => {
    const value = projector();
    const set = value.apply({
      type: EngineMessageType.SET,
      code: 5053103,
      controller: 1,
      location: EngineLocation.SPELL_TRAP,
      sequence: 0,
      position: EnginePosition.FACE_DOWN_DEFENSE,
    });
    value.apply({
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
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    const position = value.apply({
      type: EngineMessageType.POSITION_CHANGE,
      code: 5053103,
      controller: 1,
      location: EngineLocation.MONSTER,
      sequence: 0,
      prev_position: EnginePosition.FACE_DOWN_DEFENSE,
      position: EnginePosition.FACE_DOWN_DEFENSE,
    });

    expect(JSON.stringify([set.events, position.events])).not.toContain(
      "5053103",
    );
  });

  it("rotates public identity when an opponent card crosses a concealed zone", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const knownId = value.snapshot().players[1].graveyard[0]?.instanceId;
    expect(knownId).toBeDefined();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 1,
        location: EngineLocation.HAND,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    const concealedMove = value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.HAND,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.SPELL_TRAP,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    const setCard = value.snapshot().players[1].spellsAndTraps[0];

    expect(concealedMove.events[0]).not.toHaveProperty("instanceId");
    expect(setCard?.instanceId).not.toBe(knownId);
    expect(setCard).not.toHaveProperty("code");
  });

  it("redacts face-down opponent banished cards", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.BANISHED,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    expect(value.snapshot().players[1].banished[0]).not.toHaveProperty("code");
  });

  it("moves one physical instance between zones without duplication", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.DRAW,
      player: 0,
      drawn: [{ code: 97590747, position: EnginePosition.FACE_DOWN_DEFENSE }],
    });
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.HAND,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });

    const snapshot = value.snapshot();
    expect(snapshot.players[0].hand).toHaveLength(0);
    expect(snapshot.players[0].monsters).toHaveLength(1);
    expect(snapshot.players[0].monsters[0]?.code).toBe(97590747);
  });

  it("preserves sparse monster slot sequences when another slot moves", () => {
    const value = projector();
    const codes = [97590747, 5053103, 46986414, 44519536];
    const sequences = [4, 0, 6, 5];

    for (const [index, sequence] of sequences.entries()) {
      value.apply({
        type: EngineMessageType.MOVE,
        card: codes[index]!,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 39 - index,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
    }

    value.apply({
      type: EngineMessageType.MOVE,
      card: codes[1]!,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    value.apply({
      type: EngineMessageType.POSITION_CHANGE,
      code: codes[0]!,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 4,
      prev_position: EnginePosition.FACE_UP_ATTACK,
      position: EnginePosition.FACE_UP_DEFENSE,
    });

    expect(
      value
        .snapshot()
        .players[0].monsters.toSorted(
          (left, right) => left.sequence - right.sequence,
        )
        .map((card) => [card.code, card.sequence, card.position]),
    ).toEqual([
      [codes[0], 4, "faceUpDefense"],
      [codes[3], 5, "faceUpAttack"],
      [codes[2], 6, "faceUpAttack"],
    ]);
  });

  it("keeps Spell/Trap and Field sequence zero as separate fixed slots", () => {
    const value = projector();
    const placements = [
      { code: 97590747, location: EngineLocation.SPELL_TRAP, sequence: 0 },
      { code: 5053103, location: EngineLocation.FIELD, sequence: 0 },
      { code: 46986414, location: EngineLocation.SPELL_TRAP, sequence: 4 },
    ] as const;

    for (const [index, placement] of placements.entries()) {
      value.apply({
        type: EngineMessageType.MOVE,
        card: placement.code,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 39 - index,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: placement.location,
          sequence: placement.sequence,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
    }

    value.apply({
      type: EngineMessageType.POSITION_CHANGE,
      code: placements[1].code,
      controller: 0,
      location: EngineLocation.FIELD,
      sequence: 0,
      prev_position: EnginePosition.FACE_UP_ATTACK,
      position: EnginePosition.FACE_UP_DEFENSE,
    });

    expect(
      value
        .snapshot()
        .players[0].spellsAndTraps.map((card) => [
          card.code,
          card.location,
          card.sequence,
          card.position,
        ]),
    ).toEqual([
      [placements[0].code, "spellTrap", 0, "faceUpAttack"],
      [placements[1].code, "field", 0, "faceUpDefense"],
      [placements[2].code, "spellTrap", 4, "faceUpAttack"],
    ]);

    value.apply({
      type: EngineMessageType.MOVE,
      card: placements[1].code,
      from: {
        controller: 0,
        location: EngineLocation.FIELD,
        sequence: 0,
        position: EnginePosition.FACE_UP_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });

    const player = value.snapshot().players[0];
    expect(
      player.spellsAndTraps.map((card) => [
        card.code,
        card.location,
        card.sequence,
        card.position,
      ]),
    ).toEqual([
      [placements[0].code, "spellTrap", 0, "faceUpAttack"],
      [placements[2].code, "spellTrap", 4, "faceUpAttack"],
    ]);
    expect(
      player.graveyard.map((card) => [
        card.code,
        card.location,
        card.sequence,
        card.position,
      ]),
    ).toEqual([[placements[1].code, "graveyard", 0, "faceUpAttack"]]);
  });

  it("rejects duplicate fixed-slot destinations without mutating state", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 39,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 4,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });

    expect(() =>
      value.apply({
        type: EngineMessageType.MOVE,
        card: 5053103,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 38,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 4,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      }),
    ).toThrow("Fixed slot monster 4 for player 0 is already occupied");
    expect(value.snapshot().players[0]).toMatchObject({
      deckCount: 39,
      monsters: [{ code: 97590747, sequence: 4 }],
    });
  });

  it("rejects moves from missing fixed slots instead of fabricating cards", () => {
    const value = projector();

    expect(() =>
      value.apply({
        type: EngineMessageType.MOVE,
        card: 97590747,
        from: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 4,
          position: EnginePosition.FACE_UP_ATTACK,
        },
        to: {
          controller: 0,
          location: EngineLocation.GRAVEYARD,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      }),
    ).toThrow("Fixed slot monster 4 for player 0 is empty");
    expect(value.snapshot().players[0].graveyard).toEqual([]);
  });

  it("rejects position changes for empty fixed slots without changing state", () => {
    const value = projector();
    const before = value.snapshot();

    expect(() =>
      value.apply({
        type: EngineMessageType.POSITION_CHANGE,
        code: 97590747,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 4,
        prev_position: EnginePosition.FACE_UP_ATTACK,
        position: EnginePosition.FACE_UP_DEFENSE,
      }),
    ).toThrow("Fixed slot monster 4 for player 0 is empty");
    expect(value.snapshot()).toEqual(before);
  });

  it("keeps one card in place when a fixed-slot move repeats its address", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 39,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 4,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const before = value.snapshot().players[0];
    const instanceId = before.monsters[0]?.instanceId;

    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 4,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 4,
        position: EnginePosition.FACE_UP_DEFENSE,
      },
    });

    expect(value.snapshot().players[0]).toMatchObject({
      deckCount: 39,
      monsters: [
        {
          instanceId,
          code: 97590747,
          location: "monster",
          sequence: 4,
          position: "faceUpDefense",
        },
      ],
    });
  });

  it("continues resequencing ordered graveyard and banished lists", () => {
    const value = projector();
    for (const [index, code] of [97590747, 5053103].entries()) {
      value.apply({
        type: EngineMessageType.MOVE,
        card: code,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 39 - index,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.GRAVEYARD,
          sequence: index,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
    }
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.BANISHED,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });

    const player = value.snapshot().players[0];
    expect(player.graveyard.map((card) => [card.code, card.sequence])).toEqual([
      [5053103, 0],
    ]);
    expect(player.banished.map((card) => [card.code, card.sequence])).toEqual([
      [97590747, 0],
    ]);
  });

  it("projects shuffles and reconciles the visible human hand order", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.DRAW,
      player: 0,
      drawn: [
        { code: 97590747, position: EnginePosition.FACE_DOWN_DEFENSE },
        { code: 5053103, position: EnginePosition.FACE_DOWN_DEFENSE },
      ],
    });

    expect(
      value.apply({ type: EngineMessageType.SHUFFLE_DECK, player: 0 }).events,
    ).toEqual([{ type: "cardsShuffled", player: 0, location: "deck" }]);
    expect(
      value.apply({
        type: EngineMessageType.SHUFFLE_HAND,
        player: 0,
        cards: [5053103, 97590747],
      }).events,
    ).toEqual([{ type: "cardsShuffled", player: 0, location: "hand" }]);
    expect(
      value
        .snapshot()
        .players[0].hand.map((card) => [card.code, card.sequence]),
    ).toEqual([
      [5053103, 0],
      [97590747, 1],
    ]);
  });

  it("accepts hidden code-zero deck moves emitted while sorting", () => {
    const value = projector();

    expect(() =>
      value.apply({
        type: EngineMessageType.MOVE,
        card: 0,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 39,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 39,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
      }),
    ).not.toThrow();
    expect(value.snapshot().players[0].deckCount).toBe(40);
  });

  it("projects generic, card, display, and player hints", () => {
    const value = projector();
    const events = [
      value.apply({
        type: EngineMessageType.HINT,
        hint_type: 2,
        player: 0,
        hint: 42n,
      }),
      value.apply({
        type: EngineMessageType.CARD_HINT,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        card_hint: 1,
        description: 43n,
      }),
      value.apply({ type: EngineMessageType.SHOW_HINT, hint: "Choose a card" }),
      value.apply({
        type: EngineMessageType.PLAYER_HINT,
        player: 1,
        player_hint: 6,
        description: 44n,
      }),
    ].flatMap(({ events: projected }) => projected);

    expect(events).toEqual([
      { type: "hint", message: "System hint 42" },
      { type: "hint", message: "Card hint 1: 43" },
      { type: "hint", message: "Choose a card" },
      { type: "hint", message: "Player 2 hint 6: 44" },
    ]);
  });

  it("seeds, summons, returns, and atomically reconciles own Extra order", () => {
    const value = new DuelStateProjector(
      snapshotId("a".repeat(64)),
      [40, 40],
      [2, 1],
      [[cardCode(97590747), cardCode(5053103)], []],
    );
    const initial = value.snapshot().players[0].extraDeck;
    expect(initial.map(({ code }) => code)).toEqual([97590747, 5053103]);

    const summon = value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.EXTRA,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(summon.reconciliationRequests).toEqual([
      { type: "extraDeck", player: 0 },
    ]);
    value.reconcileExtraDeck(0, [queriedExtra(5053103)]);
    expect(value.snapshot().players[0]).toMatchObject({
      extraDeckCount: 1,
      extraDeck: [{ code: 5053103, location: "extra", sequence: 0 }],
      monsters: [{ code: 97590747 }],
    });

    const returnedMove = value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.EXTRA,
        sequence: 1,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    expect(returnedMove.reconciliationRequests).toEqual([
      { type: "extraDeck", player: 0 },
    ]);
    value.reconcileExtraDeck(0, [
      queriedExtra(5053103),
      queriedExtra(97590747),
    ]);
    const returned = value.snapshot().players[0];
    expect(returned.extraDeckCount).toBe(2);
    expect(
      returned.extraDeck.map(({ code, sequence }) => [code, sequence]),
    ).toEqual([
      [5053103, 0],
      [97590747, 1],
    ]);
    expect(returned.extraDeck[0]?.instanceId).toBe(initial[1]?.instanceId);
    expect(returned.extraDeck[1]?.instanceId).toBe(initial[0]?.instanceId);

    const before = value.snapshot();
    expect(() =>
      value.reconcileExtraDeck(0, [
        {
          owner: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
          isPublic: false,
          isHidden: true,
        },
      ]),
    ).toThrow("Own Extra Deck query omitted card code");
    expect(value.snapshot()).toEqual(before);
  });

  it("exposes opponent Extra identity only when query says public and face-up", () => {
    const value = new DuelStateProjector(
      snapshotId("a".repeat(64)),
      [40, 40],
      [0, 2],
    );
    value.reconcileExtraDeck(1, [
      {
        code: 46986414,
        owner: 1,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        isPublic: true,
        isHidden: false,
      },
      {
        code: 5053103,
        owner: 1,
        position: EnginePosition.FACE_UP_ATTACK,
        isPublic: true,
        isHidden: false,
      },
    ]);

    const opponent = value.snapshot().players[1];
    expect(opponent.extraDeckCount).toBe(2);
    expect(opponent.extraDeck).toEqual([
      expect.objectContaining({ code: 5053103, sequence: 1, faceUp: true }),
    ]);
    expect(JSON.stringify(structuredClone(value.snapshot()))).not.toContain(
      "46986414",
    );
  });

  it("requests overlay reconciliation when the projected host is missing", () => {
    const value = projector();
    const update = value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 39,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: (EngineLocation.MONSTER | EngineLocation.OVERLAY) as never,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
    });

    expect(update).toMatchObject({
      reconciliationFailure: "destination_unavailable",
      reconciliationRequests: [
        {
          type: "overlayMaterials",
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 0,
        },
      ],
    });
  });

  it("attaches, detaches, and moves hosts while preserving material identity", () => {
    const value = projector();
    for (const [code, sequence] of [
      [97590747, 0],
      [5053103, 1],
      [46986414, 2],
    ] as const) {
      value.apply({
        type: EngineMessageType.MOVE,
        card: code,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 39 - sequence,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location:
            sequence === 0 ? EngineLocation.MONSTER : EngineLocation.GRAVEYARD,
          sequence: sequence === 0 ? 0 : sequence - 1,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
    }

    const firstSourceId = value.snapshot().players[0].graveyard[0]!.instanceId;
    const attach = (code: number) =>
      value.apply({
        type: EngineMessageType.MOVE,
        card: code,
        from: {
          controller: 0,
          location: EngineLocation.GRAVEYARD,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
        to: {
          controller: 0,
          location: (EngineLocation.MONSTER | EngineLocation.OVERLAY) as never,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
          overlay_sequence: 0,
        },
      });
    expect(attach(5053103).reconciliationRequests).toEqual([
      {
        type: "overlayMaterials",
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
    ]);
    value.reconcileOverlayMaterials(
      { controller: 0, location: EngineLocation.MONSTER, sequence: 0 },
      [queriedCard(5053103)],
    );
    const firstId =
      value.snapshot().players[0].monsters[0]!.overlayMaterials[0]!.instanceId;
    expect(firstId).toBe(firstSourceId);

    const secondSourceId = value.snapshot().players[0].graveyard[0]!.instanceId;
    attach(46986414);
    value.reconcileOverlayMaterials(
      { controller: 0, location: EngineLocation.MONSTER, sequence: 0 },
      [queriedCard(5053103), queriedCard(46986414)],
    );
    const beforeDetach = value.snapshot().players[0].monsters[0]!;
    const secondId = beforeDetach.overlayMaterials[1]!.instanceId;
    expect(secondId).toBe(secondSourceId);
    expect(
      beforeDetach.overlayMaterials.map(({ code, sequence }) => [
        code,
        sequence,
      ]),
    ).toEqual([
      [5053103, 0],
      [46986414, 1],
    ]);
    expect(value.snapshot().players[0].graveyard).toEqual([]);

    const detach = value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: (EngineLocation.MONSTER | EngineLocation.OVERLAY) as never,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
      to: {
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(detach.reconciliationRequests).toEqual([
      {
        type: "overlayMaterials",
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
    ]);
    value.reconcileOverlayMaterials(
      { controller: 0, location: EngineLocation.MONSTER, sequence: 0 },
      [queriedCard(46986414)],
    );
    expect(value.snapshot().players[0].graveyard).toEqual([
      expect.objectContaining({ instanceId: firstId, code: 5053103 }),
    ]);
    expect(value.snapshot().players[0].monsters[0]?.overlayMaterials).toEqual([
      expect.objectContaining({
        instanceId: secondId,
        code: 46986414,
        sequence: 0,
      }),
    ]);

    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 4,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(value.snapshot().players[0].monsters[0]).toMatchObject({
      sequence: 4,
      counters: [],
      overlayMaterials: [{ instanceId: secondId, code: 46986414 }],
    });
  });

  it("retains hidden opponent material identity with explicit presentation visibility", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const address = {
      controller: 1 as const,
      location: EngineLocation.MONSTER,
      sequence: 0,
    };
    value.reconcileOverlayMaterials(address, [{ code: 123456789 }]);

    const parsed = parseDuelWorkerEvent({
      type: "state",
      state: value.snapshot(),
    });
    if (parsed.type !== "state") throw new Error("State event expected");
    expect(
      structuredClone(parsed).state.players[1].monsters[0]?.overlayMaterials[0],
    ).toMatchObject({ code: 123456789, identityVisible: false });
    expect(JSON.stringify(parsed)).toContain("123456789");

    value.reconcileOverlayMaterials(address, [
      { code: 123456789, identityVisible: true },
    ]);
    const visibleMaterial =
      value.snapshot().players[1].monsters[0]?.overlayMaterials[0];
    expect(visibleMaterial).toMatchObject({
      code: 123456789,
      identityVisible: true,
    });

    value.reconcileOverlayMaterials(address, [{ code: 123456789 }]);
    expect(
      value.snapshot().players[1].monsters[0]?.overlayMaterials[0],
    ).toMatchObject({
      instanceId: visibleMaterial?.instanceId,
      code: 123456789,
      identityVisible: true,
    });

    const beforeOversized = value.snapshot();
    expect(() =>
      value.reconcileOverlayMaterials(
        address,
        Array.from({ length: 257 }, (_, index) => ({ code: index + 1 })),
      ),
    ).toThrow("physical instance limit");
    expect(value.snapshot()).toEqual(beforeOversized);
  });

  it("keeps duplicate hidden material IDs stable by authoritative ordinal", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const address = {
      controller: 1 as const,
      location: EngineLocation.MONSTER,
      sequence: 0,
    };
    const hidden = [{ code: 5053103 }, { code: 5053103 }];
    value.reconcileOverlayMaterials(address, hidden);
    const initial = value.snapshot().players[1].monsters[0]!.overlayMaterials;
    expect(initial).toHaveLength(2);
    expect(initial.map(({ code }) => code)).toEqual([5053103, 5053103]);
    expect(initial.map(({ sequence }) => sequence)).toEqual([0, 1]);
    const duplicateIds = initial.map(({ instanceId }) => String(instanceId));
    expect(new Set(duplicateIds)).toHaveProperty("size", 2);

    value.reconcileOverlayMaterials(address, hidden);
    expect(
      value
        .snapshot()
        .players[1].monsters[0]!.overlayMaterials.map(({ instanceId }) =>
          String(instanceId),
        ),
    ).toEqual(duplicateIds);

    value.reconcileOverlayMaterials(address, [{ code: 97590747 }, ...hidden]);
    const prefixed = value.snapshot().players[1].monsters[0]!.overlayMaterials;
    expect(prefixed.map(({ code, sequence }) => ({ code, sequence }))).toEqual([
      { code: 97590747, sequence: 0 },
      { code: 5053103, sequence: 1 },
      { code: 5053103, sequence: 2 },
    ]);
    expect(
      prefixed.slice(1).map(({ instanceId }) => String(instanceId)),
    ).toEqual(duplicateIds);

    value.reconcileOverlayMaterials(address, hidden);
    expect(
      value
        .snapshot()
        .players[1].monsters[0]!.overlayMaterials.map(({ instanceId }) =>
          String(instanceId),
        ),
    ).toEqual(duplicateIds);
  });

  it("does not expose concealed opponent codes in overlay MOVE events", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const overlayLocation = (EngineLocation.MONSTER |
      EngineLocation.OVERLAY) as never;
    const attached = value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.EXTRA,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
    });
    expect(JSON.stringify(attached.events)).not.toContain("5053103");
    value.reconcileOverlayMaterials(
      { controller: 1, location: EngineLocation.MONSTER, sequence: 0 },
      [{ code: 5053103 }],
    );

    const hiddenDetach = value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        overlay_sequence: 0,
      },
      to: {
        controller: 1,
        location: EngineLocation.EXTRA,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    expect(JSON.stringify(hiddenDetach.events)).not.toContain("5053103");
    value.reconcileExtraDeck(1, [
      {
        code: 5053103,
        owner: 1,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        isPublic: false,
        isHidden: true,
      },
    ]);

    value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.EXTRA,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        overlay_sequence: 0,
      },
    });
    value.reconcileOverlayMaterials(
      { controller: 1, location: EngineLocation.MONSTER, sequence: 0 },
      [{ code: 5053103 }],
    );
    const publicDetach = value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        overlay_sequence: 0,
      },
      to: {
        controller: 1,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(publicDetach.events).toEqual([
      expect.objectContaining({ type: "cardMoved", card: 5053103 }),
    ]);
  });

  it("keeps concealed material identity out of detach events after host control changes", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const overlayLocation = (EngineLocation.MONSTER |
      EngineLocation.OVERLAY) as never;
    value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.EXTRA,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        overlay_sequence: 0,
      },
    });
    value.reconcileOverlayMaterials(
      { controller: 1, location: EngineLocation.MONSTER, sequence: 0 },
      [{ code: 5053103 }],
    );
    const materialId =
      value.snapshot().players[1].monsters[0]?.overlayMaterials[0]?.instanceId;

    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const detached = value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        overlay_sequence: 0,
      },
      to: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    const parsed = detached.events.map((event, index) =>
      parseDuelWorkerEvent({ type: "event", eventSequence: index + 1, event }),
    );
    const serialized = JSON.stringify(structuredClone(parsed));
    expect(serialized).not.toContain("5053103");
    expect(serialized).not.toContain(String(materialId));
  });

  it("preserves sparse opponent Extra identities by authoritative sequence", () => {
    const extraRecord = (
      code: number,
      position: number,
      isPublic: boolean,
    ) => ({
      code,
      owner: 1 as const,
      position,
      isPublic,
      isHidden: !isPublic,
    });
    const records = [
      extraRecord(5053103, EnginePosition.FACE_DOWN_DEFENSE, false),
      extraRecord(97590747, EnginePosition.FACE_UP_ATTACK, true),
    ];

    const publicMove = new DuelStateProjector(
      snapshotId("sparse-public-extra"),
      [40, 40],
      [0, 2],
    );
    publicMove.reconcileExtraDeck(1, records);
    const publicId = publicMove.snapshot().players[1].extraDeck[0]?.instanceId;
    expect(publicMove.snapshot().players[1].extraDeck[0]).toMatchObject({
      code: 97590747,
      sequence: 1,
    });
    publicMove.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 1,
        location: EngineLocation.EXTRA,
        sequence: 1,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 1,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(publicMove.snapshot().players[1].graveyard[0]).toMatchObject({
      code: 97590747,
      instanceId: publicId,
    });
    expect(publicMove.snapshot().players[1].extraDeck).toEqual([]);
    publicMove.reconcileExtraDeck(1, [records[0]!]);
    expect(publicMove.snapshot().players[1].graveyard).toHaveLength(1);

    const hiddenMove = new DuelStateProjector(
      snapshotId("sparse-hidden-extra"),
      [40, 40],
      [0, 2],
    );
    hiddenMove.apply({
      type: EngineMessageType.MOVE,
      card: 46986414,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    hiddenMove.reconcileExtraDeck(1, records);
    const stablePublicId =
      hiddenMove.snapshot().players[1].extraDeck[0]?.instanceId;
    const overlayLocation = (EngineLocation.MONSTER |
      EngineLocation.OVERLAY) as never;
    hiddenMove.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 1,
        location: EngineLocation.EXTRA,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        overlay_sequence: 0,
      },
    });
    expect(hiddenMove.snapshot().players[1].extraDeck[0]?.instanceId).toBe(
      stablePublicId,
    );
    expect(
      hiddenMove.snapshot().players[1].monsters[0]?.overlayMaterials[0]
        ?.instanceId,
    ).not.toBe(stablePublicId);
    hiddenMove.reconcileExtraDeck(1, [records[1]!]);
    hiddenMove.reconcileOverlayMaterials(
      { controller: 1, location: EngineLocation.MONSTER, sequence: 0 },
      [{ code: 5053103 }],
    );
    expect(hiddenMove.snapshot().players[1].extraDeck[0]).toMatchObject({
      code: 97590747,
      instanceId: stablePublicId,
      sequence: 0,
    });
  });

  it("deduplicates reconciliation requests from both MOVE endpoints", () => {
    const sameExtra = new DuelStateProjector(
      snapshotId("same-extra"),
      [40, 40],
      [1, 0],
      [[cardCode(97590747)], []],
    );
    expect(
      sameExtra.apply({
        type: EngineMessageType.MOVE,
        card: 97590747,
        from: {
          controller: 0,
          location: EngineLocation.EXTRA,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.EXTRA,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
      }).reconciliationRequests,
    ).toEqual([{ type: "extraDeck", player: 0 }]);

    const distinctExtra = new DuelStateProjector(
      snapshotId("distinct-extra"),
      [40, 40],
      [1, 1],
      [[cardCode(97590747)], []],
    );
    expect(
      distinctExtra.apply({
        type: EngineMessageType.MOVE,
        card: 97590747,
        from: {
          controller: 0,
          location: EngineLocation.EXTRA,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 1,
          location: EngineLocation.EXTRA,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
      }).reconciliationRequests,
    ).toEqual([
      { type: "extraDeck", player: 0 },
      { type: "extraDeck", player: 1 },
    ]);

    const overlay = projector();
    for (const sequence of [0, 1])
      overlay.apply({
        type: EngineMessageType.MOVE,
        card: 97590747 + sequence,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
    overlay.reconcileOverlayMaterials(
      { controller: 0, location: EngineLocation.MONSTER, sequence: 0 },
      [queriedCard(5053103)],
    );
    const overlayLocation = (EngineLocation.MONSTER |
      EngineLocation.OVERLAY) as never;
    const distinct = overlay.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
      to: {
        controller: 0,
        location: overlayLocation,
        sequence: 1,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
    });
    expect(distinct.reconciliationRequests).toEqual([
      {
        type: "overlayMaterials",
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
      {
        type: "overlayMaterials",
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 1,
      },
    ]);
    const same = overlay.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: overlayLocation,
        sequence: 1,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
      to: {
        controller: 0,
        location: overlayLocation,
        sequence: 1,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
    });
    expect(same.reconciliationRequests).toEqual([
      {
        type: "overlayMaterials",
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 1,
      },
    ]);
  });

  it("leaves invalid overlay moves atomic and preserves ID allocation", () => {
    const setup = () => {
      const value = projector();
      for (const sequence of [0, 1])
        value.apply({
          type: EngineMessageType.MOVE,
          card: 97590747 + sequence,
          from: {
            controller: 0,
            location: EngineLocation.DECK,
            sequence,
            position: EnginePosition.FACE_DOWN_DEFENSE,
          },
          to: {
            controller: 0,
            location: EngineLocation.MONSTER,
            sequence,
            position: EnginePosition.FACE_UP_ATTACK,
          },
        });
      value.apply({
        type: EngineMessageType.MOVE,
        card: 5053103,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 2,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.GRAVEYARD,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
      value.apply({
        type: EngineMessageType.MOVE,
        card: 5053103,
        from: {
          controller: 0,
          location: EngineLocation.GRAVEYARD,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
        to: {
          controller: 0,
          location: overlayLocation,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
          overlay_sequence: 0,
        },
      });
      value.reconcileOverlayMaterials(
        { controller: 0, location: EngineLocation.MONSTER, sequence: 0 },
        [queriedCard(5053103)],
      );
      return value;
    };
    const overlayLocation = (EngineLocation.MONSTER |
      EngineLocation.OVERLAY) as never;
    const missing = setup();
    const missingControl = setup();
    const beforeMissing = missing.snapshot();
    const missingUpdate = missing.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 9,
      },
      to: {
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(missingUpdate.reconciliationFailure).toBe("source_unavailable");
    expect(missing.snapshot()).toEqual(beforeMissing);

    const detach = setup();
    const detachControl = setup();
    const beforeDetach = detach.snapshot();
    expect(() =>
      detach.apply({
        type: EngineMessageType.MOVE,
        card: 5053103,
        from: {
          controller: 0,
          location: overlayLocation,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
          overlay_sequence: 0,
        },
        to: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 1,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      }),
    ).toThrow("already occupied");
    expect(detach.snapshot()).toEqual(beforeDetach);

    const nested = setup();
    const nestedControl = setup();
    const beforeNested = nested.snapshot();
    const failure = nested.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: overlayLocation,
        sequence: 1,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
    });
    expect(failure.reconciliationFailure).toBe("nested_materials");
    expect(nested.snapshot()).toEqual(beforeNested);

    const allocate = (value: DuelStateProjector) => {
      value.apply({
        type: EngineMessageType.MOVE,
        card: 46986414,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 2,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.GRAVEYARD,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
      return value.snapshot().players[0].graveyard[0]?.instanceId;
    };
    expect(allocate(missing)).toBe(allocate(missingControl));
    expect(allocate(detach)).toBe(allocate(detachControl));
    expect(allocate(nested)).toBe(allocate(nestedControl));
  });

  it("rejects missing overlay attach codes before every source mutation", () => {
    const overlayLocation = (EngineLocation.MONSTER |
      EngineLocation.OVERLAY) as never;
    const moveTo = {
      controller: 0 as const,
      location: overlayLocation,
      sequence: 0,
      position: EnginePosition.FACE_UP_ATTACK,
      overlay_sequence: 0,
    };
    const setupLocation = (
      location: "deck" | "hand" | "graveyard" | "extra",
    ) => {
      const value =
        location === "extra"
          ? new DuelStateProjector(
              snapshotId("missing-overlay-code-extra"),
              [40, 40],
              [1, 0],
              [[cardCode(5053103)], []],
            )
          : projector();
      if (location === "hand") {
        value.apply({
          type: EngineMessageType.DRAW,
          player: 0,
          drawn: [
            { code: 5053103, position: EnginePosition.FACE_DOWN_DEFENSE },
          ],
        });
      } else if (location === "graveyard") {
        value.apply({
          type: EngineMessageType.MOVE,
          card: 5053103,
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
      }
      const engineLocation = {
        deck: EngineLocation.DECK,
        hand: EngineLocation.HAND,
        graveyard: EngineLocation.GRAVEYARD,
        extra: EngineLocation.EXTRA,
      }[location];
      return {
        value,
        from: {
          controller: 0 as const,
          location: engineLocation,
          sequence: 0,
          position:
            location === "graveyard"
              ? EnginePosition.FACE_UP_ATTACK
              : EnginePosition.FACE_DOWN_DEFENSE,
        },
      };
    };
    const setupOverlay = () => {
      const value = projector();
      value.apply({
        type: EngineMessageType.MOVE,
        card: 97590747,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
      value.apply({
        type: EngineMessageType.MOVE,
        card: 5053103,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 1,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: overlayLocation,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
          overlay_sequence: 0,
        },
      });
      return {
        value,
        from: {
          controller: 0 as const,
          location: overlayLocation,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
          overlay_sequence: 0,
        },
      };
    };
    const cases = [
      ["deck", () => setupLocation("deck")],
      ["hand", () => setupLocation("hand")],
      ["graveyard", () => setupLocation("graveyard")],
      ["extra", () => setupLocation("extra")],
      ["overlay", setupOverlay],
    ] as const;
    const allocate = (value: DuelStateProjector) => {
      value.apply({
        type: EngineMessageType.MOVE,
        card: 46986414,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 39,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.BANISHED,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
      return value.snapshot().players[0].banished.at(-1)?.instanceId;
    };

    for (const [label, setup] of cases) {
      const failed = setup();
      const control = setup();
      const before = failed.value.snapshot();
      expect(() =>
        failed.value.apply({
          type: EngineMessageType.MOVE,
          card: 0,
          from: failed.from,
          to: moveTo,
        }),
      ).toThrow("Overlay MOVE omitted material card code");
      expect(failed.value.snapshot(), label).toEqual(before);
      expect(allocate(failed.value), label).toBe(allocate(control.value));
    }
  });

  it("rolls back valid-then-invalid reconciliation including ID allocation", () => {
    const extra = () =>
      new DuelStateProjector(
        snapshotId("atomic-extra"),
        [40, 40],
        [1, 0],
        [[cardCode(97590747)], []],
      );
    const failedExtra = extra();
    const controlExtra = extra();
    const beforeExtra = failedExtra.snapshot();
    expect(() =>
      failedExtra.reconcileExtraDeck(0, [
        queriedExtra(5053103),
        {
          owner: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
          isPublic: false,
          isHidden: true,
        },
      ]),
    ).toThrow("omitted card code");
    expect(failedExtra.snapshot()).toEqual(beforeExtra);
    failedExtra.reconcileExtraDeck(0, [queriedExtra(5053103)]);
    controlExtra.reconcileExtraDeck(0, [queriedExtra(5053103)]);
    expect(failedExtra.snapshot()).toEqual(controlExtra.snapshot());

    const overlay = () => {
      const value = projector();
      value.apply({
        type: EngineMessageType.MOVE,
        card: 97590747,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
      return value;
    };
    const failedOverlay = overlay();
    const controlOverlay = overlay();
    const address = {
      controller: 0 as const,
      location: EngineLocation.MONSTER,
      sequence: 0,
    };
    const beforeOverlay = failedOverlay.snapshot();
    expect(() =>
      failedOverlay.reconcileOverlayMaterials(address, [
        queriedCard(5053103),
        { code: -1 },
      ]),
    ).toThrow("invalid material code");
    expect(failedOverlay.snapshot()).toEqual(beforeOverlay);
    failedOverlay.reconcileOverlayMaterials(address, [queriedCard(5053103)]);
    controlOverlay.reconcileOverlayMaterials(address, [queriedCard(5053103)]);
    expect(failedOverlay.snapshot()).toEqual(controlOverlay.snapshot());
  });

  it("keeps handCount correct for hand and overlay moves", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    value.apply({
      type: EngineMessageType.DRAW,
      player: 0,
      drawn: [{ code: 5053103, position: EnginePosition.FACE_DOWN_DEFENSE }],
    });
    const overlayLocation = (EngineLocation.MONSTER |
      EngineLocation.OVERLAY) as never;
    value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: EngineLocation.HAND,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
    });
    expect(value.snapshot().players[0].handCount).toBe(0);
    value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: overlayLocation,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
      to: {
        controller: 0,
        location: EngineLocation.HAND,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
    });
    expect(value.snapshot().players[0].handCount).toBe(1);
  });

  it("restores complete projector state from a failed batch checkpoint", () => {
    const value = projector();
    const control = projector();
    const before = value.snapshot();
    const checkpoint = value.checkpoint();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(() =>
      value.reconcileCounters(
        {
          controller: 1,
          location: EngineLocation.MONSTER,
          sequence: 4,
        },
        [{ type: 1, count: 1 }],
      ),
    ).toThrow("host is unavailable");
    value.restore(checkpoint);
    expect(value.snapshot()).toEqual(before);
    const move = {
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    } as const;
    value.apply(move);
    control.apply(move);
    expect(value.snapshot()).toEqual(control.snapshot());
  });

  it("projects sorted named counters and resets them when a card leaves the field", () => {
    const value = new DuelStateProjector(
      snapshotId("counter-projection"),
      [40, 40],
      [0, 0],
      [[], []],
      {
        texts: new Map(),
        strings: {
          system: {},
          victory: {},
          counter: { "0x1": "  Spell Counter  " },
          setname: {},
        },
      },
    );
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 2,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    value.apply({
      type: EngineMessageType.ADD_COUNTER,
      counter_type: 1,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 2,
      count: 0,
    });
    expect(value.snapshot().players[0].monsters[0]?.counters).toEqual([]);
    value.apply({
      type: EngineMessageType.ADD_COUNTER,
      counter_type: 0x1002,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 2,
      count: 2,
    });
    value.apply({
      type: EngineMessageType.ADD_COUNTER,
      counter_type: 1,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 2,
      count: 3,
    });
    value.apply({
      type: EngineMessageType.ADD_COUNTER,
      counter_type: 1,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 2,
      count: 2,
    });
    expect(value.snapshot().players[0].monsters[0]?.counters).toEqual([
      { type: 1, name: "Spell Counter", count: 5 },
      { type: 0x1002, name: "Counter 0x1002", count: 2 },
    ]);
    const partial = value.apply({
      type: EngineMessageType.REMOVE_COUNTER,
      counter_type: 1,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 2,
      count: 2,
    });
    expect(partial.reconciliationRequests).toEqual([]);
    expect(value.snapshot().players[0].monsters[0]?.counters[0]?.count).toBe(3);
    const beforeUnderflow = value.snapshot();
    const underflow = value.apply({
      type: EngineMessageType.REMOVE_COUNTER,
      counter_type: 1,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 2,
      count: 4,
    });
    expect(underflow.reconciliationRequests).toHaveLength(1);
    expect(value.snapshot()).toEqual(beforeUnderflow);
    value.apply({
      type: EngineMessageType.REMOVE_COUNTER,
      counter_type: 1,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 2,
      count: 3,
    });
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 2,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(value.snapshot().players[0].graveyard[0]?.counters).toEqual([]);
  });

  it("matches core counter reset boundaries while preserving controller transfer", () => {
    const counteredMonster = () => {
      const value = projector();
      value.apply({
        type: EngineMessageType.MOVE,
        card: 97590747,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
      value.apply({
        type: EngineMessageType.ADD_COUNTER,
        counter_type: 1,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        count: 2,
      });
      return value;
    };
    for (const destination of [
      EngineLocation.HAND,
      EngineLocation.GRAVEYARD,
      EngineLocation.BANISHED,
      EngineLocation.SPELL_TRAP,
    ] as const) {
      const value = counteredMonster();
      value.apply({
        type: EngineMessageType.MOVE,
        card: 97590747,
        from: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
        to: {
          controller: 0,
          location: destination,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
      const player = value.snapshot().players[0];
      const moved =
        destination === EngineLocation.HAND
          ? player.hand[0]
          : destination === EngineLocation.GRAVEYARD
            ? player.graveyard[0]
            : destination === EngineLocation.BANISHED
              ? player.banished[0]
              : player.spellsAndTraps[0];
      expect(moved?.counters, `destination ${destination}`).toEqual([]);
    }

    const toDeck = counteredMonster();
    toDeck.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
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
    toDeck.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(toDeck.snapshot().players[0].monsters[0]?.counters).toEqual([]);

    const toOverlay = counteredMonster();
    toOverlay.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 1,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    toOverlay.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 1,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
    });
    expect(
      toOverlay.snapshot().players[0].monsters[0]?.overlayMaterials[0],
    ).not.toHaveProperty("counters");

    const transfer = counteredMonster();
    transfer.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
      to: {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    expect(transfer.snapshot().players[1].monsters[0]?.counters).toEqual([
      { type: 1, name: "Counter 0x1", count: 2 },
    ]);
  });

  it("defers invalid counter deltas to authoritative replacement without mutation", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const before = value.snapshot();
    const update = value.apply({
      type: EngineMessageType.REMOVE_COUNTER,
      counter_type: 1,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 0,
      count: 1,
    });
    expect(update.events).toEqual([]);
    expect(update.reconciliationRequests).toEqual([
      {
        type: "counters",
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
    ]);
    expect(value.snapshot()).toEqual(before);
    value.reconcileCounters(update.reconciliationRequests[0] as never, [
      { type: 2, count: 4 },
      { type: 5, count: 1 },
    ]);
    expect(value.snapshot().revision).toBe(before.revision + 1);
    expect(value.snapshot().players[0].monsters[0]?.counters).toEqual([
      { type: 2, name: "Counter 0x2", count: 4 },
      { type: 5, name: "Counter 0x5", count: 1 },
    ]);
    value.reconcileCounters(
      {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
      [],
    );
    expect(value.snapshot().players[0].monsters[0]?.counters).toEqual([]);
    const beforeInvalidQuery = value.snapshot();
    expect(() =>
      value.reconcileCounters(
        {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 0,
        },
        [
          { type: 2, count: 1 },
          { type: 1, count: 1 },
        ],
      ),
    ).toThrow("sorted and unique");
    expect(value.snapshot()).toEqual(beforeInvalidQuery);
    value.reconcileCounters(
      {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
      [{ type: 1, count: 0xffff }],
    );
    const beforeOverflow = value.snapshot();
    const overflow = value.apply({
      type: EngineMessageType.ADD_COUNTER,
      counter_type: 1,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 0,
      count: 1,
    });
    expect(overflow.reconciliationRequests).toHaveLength(1);
    expect(value.snapshot()).toEqual(beforeOverflow);

    const missing = value.apply({
      type: EngineMessageType.ADD_COUNTER,
      counter_type: 1,
      controller: 1,
      location: EngineLocation.MONSTER,
      sequence: 4,
      count: 1,
    });
    expect(missing.reconciliationRequests).toEqual([
      {
        type: "counters",
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 4,
      },
    ]);
  });

  it("defers counter additions at exact per-card, global, and text bounds", () => {
    const addMonster = (
      value: DuelStateProjector,
      sequence: number,
      code = 97590747,
    ) =>
      value.apply({
        type: EngineMessageType.MOVE,
        card: code,
        from: {
          controller: 0,
          location: EngineLocation.DECK,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
        },
        to: {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      });
    const fullCounters = Array.from({ length: 256 }, (_, index) => ({
      type: index + 1,
      count: 1,
    }));

    const perCard = projector();
    addMonster(perCard, 0);
    perCard.reconcileCounters(
      {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
      fullCounters,
    );
    expect(perCard.snapshot().players[0].monsters[0]?.counters).toHaveLength(
      256,
    );
    const beforePerCard = perCard.snapshot();
    expect(
      perCard.apply({
        type: EngineMessageType.ADD_COUNTER,
        counter_type: 257,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        count: 1,
      }).reconciliationRequests,
    ).toHaveLength(1);
    expect(perCard.snapshot()).toEqual(beforePerCard);

    const global = projector();
    for (let sequence = 0; sequence < 5; sequence += 1)
      addMonster(global, sequence, 97590747 + sequence);
    for (let sequence = 0; sequence < 4; sequence += 1)
      global.reconcileCounters(
        {
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence,
        },
        fullCounters,
      );
    expect(
      global
        .snapshot()
        .players[0].monsters.reduce(
          (total, card) => total + (card?.counters.length ?? 0),
          0,
        ),
    ).toBe(1_024);
    const beforeGlobal = global.snapshot();
    expect(
      global.apply({
        type: EngineMessageType.ADD_COUNTER,
        counter_type: 1,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 4,
        count: 1,
      }).reconciliationRequests,
    ).toHaveLength(1);
    expect(global.snapshot()).toEqual(beforeGlobal);

    const counter = Object.fromEntries(
      Array.from({ length: 256 }, (_, index) => [
        `0x${(index + 1).toString(16)}`,
        "x".repeat(1_024),
      ]),
    );
    const textBound = new DuelStateProjector(
      snapshotId("counter-text-bound"),
      [40, 40],
      [0, 0],
      [[], []],
      {
        texts: new Map(),
        strings: { system: {}, victory: {}, counter, setname: {} },
      },
    );
    addMonster(textBound, 0);
    addMonster(textBound, 1, 5053103);
    textBound.reconcileCounters(
      {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
      fullCounters,
    );
    expect(
      textBound
        .snapshot()
        .players[0].monsters[0]?.counters.reduce(
          (total, entry) => total + entry.name.length,
          0,
        ),
    ).toBe(262_144);
    const beforeText = textBound.snapshot();
    expect(
      textBound.apply({
        type: EngineMessageType.ADD_COUNTER,
        counter_type: 1,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 1,
        count: 1,
      }).reconciliationRequests,
    ).toHaveLength(1);
    expect(textBound.snapshot()).toEqual(beforeText);
  });

  it("rejects malformed counter deltas and addresses before mutation", () => {
    const cases = [
      {
        counter_type: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        count: 1,
      },
      {
        counter_type: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        count: -1,
      },
      {
        counter_type: 1,
        location: EngineLocation.MONSTER,
        sequence: -1,
        count: 1,
      },
      { counter_type: 1, location: 999, sequence: 0, count: 1 },
    ];
    for (const record of cases) {
      const value = projector();
      const before = value.snapshot();
      expect(() =>
        value.apply({
          type: EngineMessageType.ADD_COUNTER,
          counter_type: record.counter_type,
          controller: 0,
          location: record.location as never,
          sequence: record.sequence,
          count: record.count,
        }),
      ).toThrow();
      expect(value.snapshot()).toEqual(before);
    }
  });

  it("tracks actual one-based chain provenance, phases, and outcomes", () => {
    const code = 97590747;
    const value = new DuelStateProjector(
      snapshotId("chain-projection"),
      [40, 40],
      [0, 0],
      [[], []],
      {
        texts: new Map([
          [
            code,
            {
              code,
              name: "Visible Source",
              description: "",
              strings: ["", "Resolved effect text"],
            },
          ],
        ]),
        strings: { system: {}, victory: {}, counter: {}, setname: {} },
      },
    );
    value.apply({
      type: EngineMessageType.MOVE,
      card: code,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 1,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    const first = value.apply({
      type: EngineMessageType.CHAINING,
      code,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 1,
      position: EnginePosition.FACE_UP_ATTACK,
      triggering_controller: 1,
      triggering_location: EngineLocation.HAND,
      triggering_sequence: 3,
      description: (BigInt(code) << 20n) | 1n,
      chain_size: 1,
    });
    expect(
      value.apply({ type: EngineMessageType.CHAINED, chain_size: 1 }).events,
    ).toEqual([]);
    const second = value.apply({
      type: EngineMessageType.CHAINING,
      code,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 1,
      position: EnginePosition.FACE_UP_ATTACK,
      triggering_controller: 0,
      triggering_location: EngineLocation.MONSTER,
      triggering_sequence: 1,
      description: (BigInt(code) << 20n) | 1n,
      chain_size: 2,
    });
    expect(
      value.apply({ type: EngineMessageType.CHAINED, chain_size: 2 }).events,
    ).toEqual([]);
    expect(() =>
      value.apply({ type: EngineMessageType.CHAINED, chain_size: 1 }),
    ).toThrow("latest link");
    expect(first.events).toEqual([{ type: "chainChanged", size: 1 }]);
    expect(second.events).toEqual([{ type: "chainChanged", size: 2 }]);
    for (const status of [
      { type: EngineMessageType.CHAIN_SOLVING, chain_size: 2 },
      { type: EngineMessageType.CHAIN_NEGATED, chain_size: 2 },
      { type: EngineMessageType.CHAIN_SOLVED, chain_size: 2 },
      { type: EngineMessageType.CHAIN_DISABLED, chain_size: 1 },
      { type: EngineMessageType.CHAIN_SOLVING, chain_size: 1 },
      { type: EngineMessageType.CHAIN_SOLVED, chain_size: 1 },
    ] as const)
      expect(value.apply(status).events).toEqual([]);
    expect(value.snapshot().chain).toMatchObject([
      {
        index: 1,
        controller: 1,
        sourceIdentityVisible: true,
        sourceCard: code,
        label: "Visible Source",
        description: "Resolved effect text",
        phase: "solved",
        outcome: "disabled",
      },
      {
        index: 2,
        controller: 0,
        phase: "solved",
        outcome: "negated",
      },
    ]);
    expect(() =>
      value.apply({ type: EngineMessageType.CHAIN_SOLVING, chain_size: 3 }),
    ).toThrow("unknown link");
    const ended = value.apply({ type: EngineMessageType.CHAIN_END });
    expect(ended.events).toEqual([{ type: "chainChanged", size: 0 }]);
    expect(value.snapshot().chain).toEqual([]);
    expect(value.apply({ type: EngineMessageType.CHAIN_END }).events).toEqual(
      [],
    );
  });

  it.each([0, 2, 256, 1.5])(
    "rejects invalid first CHAINING index %s atomically",
    (chainSize) => {
      const value = projector();
      const before = value.snapshot();
      expect(() =>
        value.apply({
          type: EngineMessageType.CHAINING,
          code: 5053103,
          controller: 1,
          location: EngineLocation.HAND,
          sequence: 0,
          position: EnginePosition.FACE_DOWN_DEFENSE,
          triggering_controller: 1,
          triggering_location: EngineLocation.HAND,
          triggering_sequence: 0,
          description: 0n,
          chain_size: chainSize,
        }),
      ).toThrow("link index");
      expect(value.snapshot()).toEqual(before);
    },
  );

  it("rejects duplicate and skipped CHAINING indices", () => {
    const value = projector();
    const chaining = (chain_size: number) =>
      ({
        type: EngineMessageType.CHAINING,
        code: 5053103,
        controller: 1 as const,
        location: EngineLocation.HAND,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        triggering_controller: 1 as const,
        triggering_location: EngineLocation.HAND,
        triggering_sequence: 0,
        description: 0n,
        chain_size,
      }) as const;
    value.apply(chaining(1));
    const before = value.snapshot();
    expect(() => value.apply(chaining(1))).toThrow("link index");
    expect(value.snapshot()).toEqual(before);
    expect(() => value.apply(chaining(3))).toThrow("link index");
    expect(value.snapshot()).toEqual(before);
  });

  it("resolves a visible overlay material as the chain source", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    value.apply({
      type: EngineMessageType.MOVE,
      card: 5053103,
      from: {
        controller: 0,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        overlay_sequence: 0,
      },
    });
    const material =
      value.snapshot().players[0].monsters[0]?.overlayMaterials[0];
    value.apply({
      type: EngineMessageType.CHAINING,
      code: 5053103,
      controller: 0,
      location: EngineLocation.MONSTER,
      sequence: 0,
      position: EnginePosition.FACE_UP_ATTACK,
      overlay_sequence: 0,
      triggering_controller: 0,
      triggering_location: EngineLocation.MONSTER,
      triggering_sequence: 0,
      description: 0n,
      chain_size: 1,
    });
    expect(value.snapshot().chain[0]).toMatchObject({
      sourceIdentityVisible: true,
      sourceInstanceId: material?.instanceId,
      sourceCard: 5053103,
    });
  });

  it("keeps concealed overlay chain source generic across clone boundary", () => {
    const value = projector();
    value.apply({
      type: EngineMessageType.MOVE,
      card: 97590747,
      from: {
        controller: 1,
        location: EngineLocation.DECK,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      },
      to: {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
      },
    });
    value.reconcileOverlayMaterials(
      {
        controller: 1,
        location: EngineLocation.MONSTER,
        sequence: 0,
      },
      [{ code: 5053103, identityVisible: false }],
    );
    value.apply({
      type: EngineMessageType.CHAINING,
      code: 5053103,
      controller: 1,
      location: EngineLocation.MONSTER,
      sequence: 0,
      position: EnginePosition.FACE_UP_ATTACK,
      overlay_sequence: 0,
      triggering_controller: 1,
      triggering_location: EngineLocation.MONSTER,
      triggering_sequence: 0,
      description: BigInt(5053103) << 20n,
      chain_size: 1,
    });
    const parsed = parseDuelWorkerEvent({
      type: "state",
      state: value.snapshot(),
    });
    if (parsed.type !== "state") throw new Error("State event missing");
    const link = structuredClone(parsed.state.chain[0]);
    expect(link).toEqual({
      index: 1,
      controller: 1,
      sourceIdentityVisible: false,
      label: "Card effect",
      phase: "pending",
      outcome: "normal",
    });
    expect(JSON.stringify(link)).not.toContain("5053103");
  });

  it("keeps concealed chain source identity and description out of projection", () => {
    const code = 5053103;
    const value = new DuelStateProjector(
      snapshotId("hidden-chain"),
      [40, 40],
      [0, 0],
      [[], []],
      {
        texts: new Map([
          [
            code,
            {
              code,
              name: "Private Source",
              description: "",
              strings: ["Private effect text"],
            },
          ],
        ]),
        strings: { system: {}, victory: {}, counter: {}, setname: {} },
      },
    );
    value.apply({
      type: EngineMessageType.CHAINING,
      code,
      controller: 1,
      location: EngineLocation.HAND,
      sequence: 0,
      position: EnginePosition.FACE_DOWN_DEFENSE,
      triggering_controller: 1,
      triggering_location: EngineLocation.HAND,
      triggering_sequence: 0,
      description: BigInt(code) << 20n,
      chain_size: 1,
    });
    const link = value.snapshot().chain[0];
    expect(link).toEqual({
      index: 1,
      controller: 1,
      sourceIdentityVisible: false,
      label: "Card effect",
      phase: "pending",
      outcome: "normal",
    });
    expect(JSON.stringify(link)).not.toContain(code.toString());
    expect(JSON.stringify(link)).not.toContain("Private");
  });

  it("tracks life points, turns, phases, and core-provided results", () => {
    const value = projector();
    value.apply({ type: EngineMessageType.NEW_TURN, player: 0 });
    value.apply({ type: EngineMessageType.NEW_PHASE, phase: 4 });
    value.apply({ type: EngineMessageType.DAMAGE, player: 1, amount: 1800 });
    const update = value.apply({
      type: EngineMessageType.WIN,
      player: 0,
      reason: 1,
    });

    expect(value.snapshot()).toMatchObject({
      turn: 1,
      turnPlayer: 0,
      phase: "main1",
    });
    expect(value.snapshot().players[1].lifePoints).toBe(6200);
    expect(update.result).toEqual({
      type: "completed",
      winner: 0,
      loser: 1,
      reason: 1,
    });
  });
});
