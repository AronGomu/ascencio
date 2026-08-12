import { describe, expect, it } from "vitest";
import {
  cardCode,
  cardInstanceId,
  snapshotId,
} from "../../src/duel/contracts/ids.ts";
import type {
  CardPosition,
  PlayerIndex,
  PublicCard,
  PublicDuelState,
  PublicPlayerState,
} from "../../src/duel/contracts/public-duel-state.ts";
import { mapSnapshotToBoard } from "../../src/field/board-view-model.ts";
import { zoneListEntries } from "../../src/field/zone-list.ts";
import { deckSlots } from "../fixtures/board-public-states.ts";

const CARD_TEXTS = new Map([
  [97590747, { name: "The Legendary Fisherman" }],
  [5053103, { name: "Axe Raider" }],
  [89631139, { name: "Blue-Eyes White Dragon" }],
]);

function card(
  id: string,
  code: number | undefined,
  controller: PlayerIndex,
  location: PublicCard["location"],
  sequence: number,
  position: CardPosition = "faceUpAttack",
): PublicCard {
  return {
    instanceId: cardInstanceId(id),
    ...(code === undefined ? {} : { code: cardCode(code) }),
    owner: controller,
    controller,
    location,
    sequence,
    position,
    faceUp: position === "faceUpAttack" || position === "faceUpDefense",
    counters: [],
    overlayMaterials: [],
  };
}

function player(index: PlayerIndex): PublicPlayerState {
  return {
    player: index,
    lifePoints: 8000,
    deckCount: 0,
    deck: deckSlots(index, 0),
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

function state(
  id: string,
  player0: Partial<PublicPlayerState> = {},
  player1: Partial<PublicPlayerState> = {},
): PublicDuelState {
  return {
    snapshotId: snapshotId(id.padEnd(64, "0").slice(0, 64)),
    revision: 1,
    turn: 1,
    turnPlayer: 0,
    phase: "main1",
    layout: { extraMonsterZones: true },
    players: [
      { ...player(0), ...player0, player: 0 },
      { ...player(1), ...player1, player: 1 },
    ],
    chain: [],
  };
}

function stackFor(
  snapshot: PublicDuelState,
  id: `p${0 | 1}:${"deck" | "extra" | "graveyard" | "banished"}`,
) {
  const result = mapSnapshotToBoard(snapshot);
  if (!result.ok)
    throw new Error(`Fixture mapping failed: ${result.error.type}`);
  const stack = result.value.stacks.find((value) => value.id === id);
  if (stack === undefined) throw new Error(`Missing stack ${id}`);
  return stack;
}

describe("zoneListEntries", () => {
  it("numbers graveyard entries bottom first", () => {
    const snapshot = state("gy4", {
      graveyard: [
        card("gy-0", 97590747, 0, "graveyard", 0),
        card("gy-1", 5053103, 0, "graveyard", 1),
        card("gy-2", 97590747, 0, "graveyard", 2),
        card("gy-3", 89631139, 0, "graveyard", 3),
      ],
    });
    const stack = stackFor(snapshot, "p0:graveyard");

    const entries = zoneListEntries(stack, snapshot, CARD_TEXTS);

    expect(entries.map((entry) => entry.position)).toEqual([1, 2, 3, 4]);
    expect(entries[3]?.code).toBe(cardCode(89631139));
  });

  it("trusts projected code for known face-down identity", () => {
    const snapshot = state(
      "knownBanished",
      {},
      {
        banished: [
          card("ban-known", 5053103, 1, "banished", 0, "faceDownDefense"),
        ],
      },
    );
    const entries = zoneListEntries(
      stackFor(snapshot, "p1:banished"),
      snapshot,
      CARD_TEXTS,
    );

    expect(entries[0]).toMatchObject({
      identityVisible: true,
      code: cardCode(5053103),
      label: "Axe Raider",
    });
  });

  it("keeps unknown face-down identity hidden", () => {
    const snapshot = state(
      "unknownBanished",
      {},
      {
        banished: [
          card("ban-unknown", undefined, 1, "banished", 0, "faceDownDefense"),
        ],
      },
    );
    const entries = zoneListEntries(
      stackFor(snapshot, "p1:banished"),
      snapshot,
      CARD_TEXTS,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.identityVisible).toBe(false);
    expect(entries[0]?.code).toBeUndefined();
    expect(entries[0]?.label).toBe("Face-down card");
  });

  it("lists the whole own extra deck", () => {
    const snapshot = state("extra3", {
      extraDeckCount: 3,
      extraDeck: [
        card("extra-0", 97590747, 0, "extra", 0, "faceDownDefense"),
        card("extra-1", 5053103, 0, "extra", 1, "faceDownDefense"),
        card("extra-2", 89631139, 0, "extra", 2, "faceDownDefense"),
      ],
    });
    const stack = stackFor(snapshot, "p0:extra");

    const entries = zoneListEntries(stack, snapshot, CARD_TEXTS);

    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => entry.identityVisible)).toBe(true);
  });

  it("hides the opponent extra deck", () => {
    const snapshot = state(
      "extraOpp3",
      {},
      {
        extraDeckCount: 3,
        extraDeck: [
          card("extra-opp-0", undefined, 1, "extra", 0, "faceDownDefense"),
          card("extra-opp-1", undefined, 1, "extra", 1, "faceDownDefense"),
          card("extra-opp-2", undefined, 1, "extra", 2, "faceDownDefense"),
        ],
      },
    );
    const stack = stackFor(snapshot, "p1:extra");

    const entries = zoneListEntries(stack, snapshot, CARD_TEXTS);

    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => !entry.identityVisible)).toBe(true);
  });

  it("lists one entry per remaining deck card", () => {
    const snapshot = state("deck5", {
      deckCount: 5,
      deck: deckSlots(0, 5),
    });
    const stack = stackFor(snapshot, "p0:deck");

    const entries = zoneListEntries(stack, snapshot, CARD_TEXTS);

    expect(entries).toHaveLength(5);
    expect(entries.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5]);
    expect(entries.every((entry) => !entry.identityVisible)).toBe(true);
    expect(entries.every((entry) => entry.label === "Face-down card")).toBe(
      true,
    );
  });

  it("shows a revealed deck position face up", () => {
    const snapshot = state("deckReveal", {
      deckCount: 5,
      deck: [
        card("deck-p0-0", 97590747, 0, "deck", 0),
        ...deckSlots(0, 5).slice(1),
      ],
    });
    const stack = stackFor(snapshot, "p0:deck");

    const entries = zoneListEntries(stack, snapshot, CARD_TEXTS);

    expect(entries[0]).toMatchObject({
      position: 1,
      code: cardCode(97590747),
      identityVisible: true,
      label: "The Legendary Fisherman",
    });
    expect(entries.slice(1).every((entry) => !entry.identityVisible)).toBe(
      true,
    );
  });

  it("never leaks an unrevealed own deck card", () => {
    const snapshot = state("deckOwnHidden", {
      deckCount: 1,
      deck: deckSlots(0, 1),
    });
    const stack = stackFor(snapshot, "p0:deck");

    const entries = zoneListEntries(stack, snapshot, CARD_TEXTS);

    expect(entries[0]?.identityVisible).toBe(false);
    expect(entries[0]?.code).toBeUndefined();
  });

  it("lists the opponent deck face-down", () => {
    const snapshot = state(
      "deckOpponent40",
      {},
      { deckCount: 40, deck: deckSlots(1, 40) },
    );
    const stack = stackFor(snapshot, "p1:deck");

    const entries = zoneListEntries(stack, snapshot, CARD_TEXTS);

    expect(entries).toHaveLength(40);
    expect(entries.every((entry) => !entry.identityVisible)).toBe(true);
    expect(entries.every((entry) => entry.code === undefined)).toBe(true);
  });

  it("reflects an empty deck", () => {
    const snapshot = state("deckEmpty", { deckCount: 0, deck: [] });
    const stack = stackFor(snapshot, "p0:deck");

    expect(zoneListEntries(stack, snapshot, CARD_TEXTS)).toEqual([]);
  });
});
