import { describe, expect, it } from "vitest";
import {
  cardCode,
  cardInstanceId,
  snapshotId,
} from "../../src/battle/duel/contracts/ids.ts";
import type {
  PublicCard,
  PublicDuelState,
  PublicPlayerState,
} from "../../src/battle/duel/contracts/public-duel-state.ts";
import {
  mapSnapshotToBoard,
  type BoardViewModel,
} from "../../src/battle/field/board-view-model.ts";
import { placementZoneCandidates } from "../../src/battle/field/placement-candidates.ts";
import { deckSlots } from "../fixtures/board-public-states.ts";

function occupant(
  location: "monster" | "spellTrap" | "field",
  sequence: number,
): PublicCard {
  return {
    instanceId: cardInstanceId(`occupant-${location}-${sequence}`),
    code: cardCode(97590747),
    owner: 0,
    controller: 0,
    location,
    sequence,
    position: "faceUpAttack",
    faceUp: true,
    counters: [],
    overlayMaterials: [],
  };
}

function player(index: 0 | 1): PublicPlayerState {
  return {
    player: index,
    lifePoints: 8000,
    deckCount: 35,
    deck: deckSlots(index, 35),
    extraDeckCount: 0,
    handCount: 0,
    hand: [],
    extraDeck: [],
    monsters: [],
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
  };
}

/** Board built through the real snapshot mapper, so `zoneId` occupancy is the
 *  engine's own placement rather than a hand-written guess. */
function boardWith(occupants: readonly PublicCard[]): BoardViewModel {
  const snapshot: PublicDuelState = {
    snapshotId: snapshotId("c".repeat(64)),
    revision: 1,
    turn: 1,
    turnPlayer: 0,
    phase: "main1",
    layout: { extraMonsterZones: true },
    players: [
      {
        ...player(0),
        monsters: occupants.filter((card) => card.location === "monster"),
        spellsAndTraps: occupants.filter(
          (card) => card.location === "spellTrap" || card.location === "field",
        ),
      },
      player(1),
    ],
    chain: [],
  };
  const result = mapSnapshotToBoard(snapshot);
  if (!result.ok) throw new Error(`Board mapping failed: ${result.error.type}`);
  return result.value;
}

describe("placementZoneCandidates", () => {
  it("summon offers empty monster zones", () => {
    const candidates = placementZoneCandidates(
      "summon",
      boardWith([occupant("monster", 2)]),
    );

    expect([...candidates].toSorted()).toEqual([
      "p0:mainMonster:0",
      "p0:mainMonster:1",
      "p0:mainMonster:3",
      "p0:mainMonster:4",
    ]);
    expect(candidates).not.toContain("p0:mainMonster:2");
  });

  it("special summon adds the extra monster zones", () => {
    const candidates = placementZoneCandidates("specialSummon", boardWith([]));

    expect(candidates).toHaveLength(7);
    expect([...candidates].toSorted()).toEqual([
      "p0:mainMonster:0",
      "p0:mainMonster:1",
      "p0:mainMonster:2",
      "p0:mainMonster:3",
      "p0:mainMonster:4",
      "shared:extraMonster:left",
      "shared:extraMonster:right",
    ]);
  });

  it("set monster offers the same zones as a normal summon", () => {
    expect(placementZoneCandidates("setMonster", boardWith([]))).toEqual(
      placementZoneCandidates("summon", boardWith([])),
    );
  });

  it("activate offers empty spell zones", () => {
    const candidates = placementZoneCandidates(
      "activate",
      boardWith([occupant("spellTrap", 0)]),
    );

    expect([...candidates].toSorted()).toEqual([
      "p0:spellTrap:1",
      "p0:spellTrap:2",
      "p0:spellTrap:3",
      "p0:spellTrap:4",
    ]);
  });

  it("set spell or trap offers empty spell zones", () => {
    expect(placementZoneCandidates("setSpellTrap", boardWith([]))).toEqual([
      "p0:spellTrap:0",
      "p0:spellTrap:1",
      "p0:spellTrap:2",
      "p0:spellTrap:3",
      "p0:spellTrap:4",
    ]);
  });

  it("field zone is never a candidate", () => {
    for (const action of [
      "summon",
      "specialSummon",
      "setMonster",
      "setSpellTrap",
      "activate",
    ] as const) {
      expect(placementZoneCandidates(action, boardWith([]))).not.toContain(
        "p0:field",
      );
    }
  });

  it("attack yields nothing", () => {
    expect(placementZoneCandidates("attack", boardWith([]))).toEqual([]);
  });

  it("never offers an opponent zone", () => {
    for (const action of [
      "summon",
      "specialSummon",
      "setMonster",
      "setSpellTrap",
      "activate",
    ] as const) {
      expect(
        placementZoneCandidates(action, boardWith([])).filter((zoneId) =>
          zoneId.startsWith("p1:"),
        ),
      ).toEqual([]);
    }
  });
});
