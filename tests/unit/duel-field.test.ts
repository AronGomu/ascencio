import { describe, expect, it } from "vitest";
import type { PublicDuelState } from "../../src/duel/contracts/public-duel-state.ts";
import { resolvePromptChoiceBoardTarget } from "../../src/field/card-mapping.ts";
import {
  mapSnapshotToBoard,
  type BoardViewModel,
} from "../../src/field/board-view-model.ts";
import {
  fieldZoneId,
  mapEngineFieldAddress,
  STANDARD_DUEL_FIELD_LAYOUT,
  type EngineFieldAddress,
  type PhysicalZoneId,
} from "../../src/field/duel-field-layout.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_TARGET_PROMPT,
  BOARD_VIEW_MODEL_FIXTURES,
  DUPLICATE_SHARED_OCCUPANCY,
  TWO_CARD_GRAVEYARD_STATE,
  promptChoice,
} from "../fixtures/board-view-model.ts";
import {
  deckSlots,
  publicStateCard,
  RICH_PUBLIC_DUEL_STATE,
} from "../fixtures/board-public-states.ts";

describe("duel field mapping", () => {
  it("creates 34 unique Standard physical controls with two shared EMZs", () => {
    const layout = STANDARD_DUEL_FIELD_LAYOUT;
    expect(layout).toHaveLength(34);
    expect(new Set(layout.map(({ id }) => id)).size).toBe(layout.length);
    expect(layout.filter(({ player }) => player === 0)).toHaveLength(16);
    expect(layout.filter(({ player }) => player === 1)).toHaveLength(16);
    expect(layout.filter(({ player }) => player === "shared")).toEqual([
      expect.objectContaining({ id: "shared:extraMonster:left" }),
      expect.objectContaining({ id: "shared:extraMonster:right" }),
    ]);
    expect(layout).toContainEqual(
      expect.objectContaining({ id: fieldZoneId(0, "monster", 0) }),
    );
    expect(
      layout.every(({ x, y, width, height }) =>
        [x, y, width, height].every((value) => value > 0 && value <= 1),
      ),
    ).toBe(true);
    expect(layout).toContainEqual(
      expect.objectContaining({
        id: "p0:mainMonster:0",
        x: 440 / 1280,
        y: 470 / 720,
        width: 82 / 1280,
        height: 114 / 720,
      }),
    );
  });

  it.each<readonly [EngineFieldAddress, PhysicalZoneId]>([
    [{ player: 0, location: "monster", sequence: 0 }, "p0:mainMonster:0"],
    [{ player: 0, location: "monster", sequence: 4 }, "p0:mainMonster:4"],
    [{ player: 1, location: "monster", sequence: 0 }, "p1:mainMonster:0"],
    [{ player: 1, location: "monster", sequence: 4 }, "p1:mainMonster:4"],
    [
      { player: 0, location: "monster", sequence: 5 },
      "shared:extraMonster:left",
    ],
    [
      { player: 0, location: "monster", sequence: 6 },
      "shared:extraMonster:right",
    ],
    [
      { player: 1, location: "monster", sequence: 5 },
      "shared:extraMonster:right",
    ],
    [
      { player: 1, location: "monster", sequence: 6 },
      "shared:extraMonster:left",
    ],
    [{ player: 0, location: "spellTrap", sequence: 0 }, "p0:spellTrap:0"],
    [{ player: 0, location: "spellTrap", sequence: 1 }, "p0:spellTrap:1"],
    [{ player: 0, location: "spellTrap", sequence: 2 }, "p0:spellTrap:2"],
    [{ player: 0, location: "spellTrap", sequence: 3 }, "p0:spellTrap:3"],
    [{ player: 0, location: "spellTrap", sequence: 4 }, "p0:spellTrap:4"],
    [{ player: 1, location: "spellTrap", sequence: 0 }, "p1:spellTrap:0"],
    [{ player: 1, location: "spellTrap", sequence: 1 }, "p1:spellTrap:1"],
    [{ player: 1, location: "spellTrap", sequence: 2 }, "p1:spellTrap:2"],
    [{ player: 1, location: "spellTrap", sequence: 3 }, "p1:spellTrap:3"],
    [{ player: 1, location: "spellTrap", sequence: 4 }, "p1:spellTrap:4"],
    [{ player: 0, location: "field", sequence: 0 }, "p0:field"],
    [{ player: 1, location: "field", sequence: 0 }, "p1:field"],
    [{ player: 0, location: "pendulum", sequence: 0 }, "p0:spellTrap:0"],
    [{ player: 0, location: "pendulum", sequence: 1 }, "p0:spellTrap:4"],
    [{ player: 1, location: "pendulum", sequence: 0 }, "p1:spellTrap:0"],
    [{ player: 1, location: "pendulum", sequence: 1 }, "p1:spellTrap:4"],
  ])("maps engine address %j to %s", (address, zoneId) => {
    expect(mapEngineFieldAddress(address)).toEqual({ ok: true, zoneId });
  });

  it.each<EngineFieldAddress>([
    { player: 0, location: "monster", sequence: -1 },
    { player: 0, location: "monster", sequence: 0.5 },
    { player: 0, location: "monster", sequence: 7 },
    { player: 1, location: "monster", sequence: 8 },
    { player: 0, location: "spellTrap", sequence: -1 },
    { player: 0, location: "spellTrap", sequence: 5 },
    { player: 1, location: "spellTrap", sequence: 7 },
    { player: 0, location: "field", sequence: -1 },
    { player: 0, location: "field", sequence: 1 },
    { player: 1, location: "pendulum", sequence: -1 },
    { player: 1, location: "pendulum", sequence: 2 },
  ])("returns a typed error for unsupported address %j", (address) => {
    expect(mapEngineFieldAddress(address)).toEqual({
      ok: false,
      error: { type: "unsupported_field_address", address },
    });
  });

  it("rejects unsafe players and keeps unsupported diagnostics immutable", () => {
    const unsafeAddress = {
      player: 2,
      location: "monster" as const,
      sequence: 0,
    };
    const result = mapEngineFieldAddress(
      unsafeAddress as unknown as EngineFieldAddress,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: "unsupported_field_address",
        address: unsafeAddress,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.ok) throw new Error("Unsafe player unexpectedly mapped");
    expect(Object.isFrozen(result.error)).toBe(true);
    expect(Object.isFrozen(result.error.address)).toBe(true);

    unsafeAddress.sequence = 4;
    expect(result.error.address.sequence).toBe(0);
  });
});

function mappedBoard(
  fixture: keyof typeof BOARD_VIEW_MODEL_FIXTURES,
): BoardViewModel {
  const result = mapSnapshotToBoard(
    BOARD_VIEW_MODEL_FIXTURES[fixture],
    BOARD_CARD_TEXTS,
  );
  if (!result.ok) throw new Error(`Fixture ${fixture} failed to map`);
  return result.value;
}

function revealedDeckSnapshot(): PublicDuelState {
  return {
    ...RICH_PUBLIC_DUEL_STATE,
    players: [
      {
        ...RICH_PUBLIC_DUEL_STATE.players[0],
        deckCount: 40,
        deck: [
          publicStateCard("deck-p0-0", 97590747, 0, "deck", 0, "faceUpAttack"),
          ...deckSlots(0, 40).slice(1),
        ],
      },
      RICH_PUBLIC_DUEL_STATE.players[1],
    ],
  };
}

describe("semantic board view model", () => {
  it.each(Object.entries(BOARD_VIEW_MODEL_FIXTURES))(
    "maps %s with stable normalized physical controls",
    (_fixture, snapshot) => {
      const result = mapSnapshotToBoard(snapshot, BOARD_CARD_TEXTS);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.zones).toHaveLength(34);
      expect(new Set(result.value.zones.map(({ id }) => id))).toHaveLength(34);
      expect(
        result.value.zones.every(({ x, y, width, height }) =>
          [x, y, width, height].every(
            (coordinate) => coordinate >= 0 && coordinate <= 1,
          ),
        ),
      ).toBe(true);
      expect(
        result.value.cards.every(({ x, y, width, height }) =>
          [x, y, width, height].every(
            (coordinate) => coordinate >= 0 && coordinate <= 1,
          ),
        ),
      ).toBe(true);
      const mountedPublicCards = [
        ...snapshot.players[0].hand,
        ...snapshot.players.flatMap((player) => [
          ...player.monsters,
          ...player.spellsAndTraps,
        ]),
      ];
      for (const card of mountedPublicCards)
        expect(
          result.value.cards.filter(({ id }) => id === card.instanceId),
        ).toHaveLength(1);
    },
  );

  it("maps the same snapshot deeply equally with stable frozen keys", () => {
    const first = mappedBoard("ST-08");
    const second = mappedBoard("ST-08");

    expect(first).toEqual(second);
    expect([...first.nav]).toEqual([...second.nav]);
    expect(first.cards.map(({ id, targetId }) => [id, targetId])).toEqual(
      second.cards.map(({ id, targetId }) => [id, targetId]),
    );
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.cards)).toBe(true);
    expect(Object.isFrozen(first.cards[0])).toBe(true);
    expect(Object.isFrozen(first.nav)).toBe(true);
    expect("set" in first.nav).toBe(false);
  });

  it("maps ST-01 hands without exposing opponent hand identity", () => {
    const board = mappedBoard("ST-01");
    expect(board.cards).toHaveLength(3);
    expect(board.cards.find(({ id }) => id === "st01-own-hand")).toMatchObject({
      zoneId: "p0:hand",
      hidden: false,
      label: expect.stringContaining("The Legendary Fisherman"),
    });
    const hidden = board.cards.filter(
      ({ player, zoneId }) => player === 1 && zoneId === "p1:hand",
    );
    expect(hidden).toHaveLength(2);
    expect(
      hidden.every(({ label }) => label === "Hidden opponent hand card"),
    ).toBe(true);
    expect(JSON.stringify(hidden)).not.toContain("46986414");
    expect(JSON.stringify(hidden)).not.toContain("st01-private-opponent-hand");
    expect(JSON.stringify(hidden)).not.toContain("Dark Magician");
  });

  it("maps ST-02 sparse fixed slots exactly once", () => {
    const board = mappedBoard("ST-02");
    expect(board.cards.map(({ id, zoneId }) => [id, zoneId])).toEqual([
      ["st02-main-zero", "p0:mainMonster:0"],
      ["st02-main-four", "p0:mainMonster:4"],
    ]);
    expect(new Set(board.cards.map(({ id }) => id))).toHaveLength(
      board.cards.length,
    );
  });

  it("maps ST-03 shared EMZ aliases to two physical targets", () => {
    const board = mappedBoard("ST-03");
    expect(board.cards.map(({ id, zoneId }) => [id, zoneId])).toEqual([
      ["st03-shared-left", "shared:extraMonster:left"],
      ["st03-shared-right", "shared:extraMonster:right"],
    ]);
    expect(
      board.zones
        .filter(({ player }) => player === "shared")
        .map(({ id }) => id),
    ).toEqual(["shared:extraMonster:left", "shared:extraMonster:right"]);
  });

  it("maps ST-04 positions and privacy-safe accessible labels", () => {
    const board = mappedBoard("ST-04");
    expect(
      board.cards.map(({ position, orientation, hidden }) => ({
        position,
        orientation,
        hidden,
      })),
    ).toEqual([
      { position: "faceUpAttack", orientation: "upright", hidden: false },
      { position: "faceUpDefense", orientation: "sideways", hidden: false },
      { position: "faceDownAttack", orientation: "upright", hidden: true },
      { position: "faceDownDefense", orientation: "sideways", hidden: true },
    ]);
    expect(board.cards[0]?.label).toContain("face-up attack");
    expect(board.cards[2]?.label).toBe(
      "Hidden card in Your Main Monster 3, face-down attack",
    );
    expect(board.cards[2]?.label).not.toContain("Dark Magician");
    expect(JSON.stringify(board.cards[2])).not.toContain("46986414");
  });

  it("maps ST-07 counter and visibility-safe material details", () => {
    const host = mappedBoard("ST-07").cards[0];
    if (host === undefined) throw new Error("Missing ST-07 host card");
    expect(host.counters).toEqual([
      { type: 1, name: "Spell Counter", count: 3 },
    ]);
    expect(host.materials).toEqual([
      {
        id: "material:st07-visible-material",
        instanceId: "st07-visible-material",
        sequence: 0,
        identityVisible: true,
        code: 5053103,
        label: "Axe Raider",
      },
      {
        id: `hidden-material:${"7".repeat(64)}:st07-host:1`,
        sequence: 1,
        identityVisible: false,
        label: "Hidden material",
      },
    ]);
    expect(host.label).toContain("3 Spell Counters");
    expect(host.label).toContain("2 materials");
    expect(JSON.stringify(host)).not.toContain("st07-private-material");
    expect(JSON.stringify(host)).not.toContain("46986414");
  });

  it("maps ST-08 closed stack summaries and public chain state", () => {
    const board = mappedBoard("ST-08");
    const extra = board.stacks.find(({ id }) => id === "p0:extra");
    const graveyard = board.stacks.find(({ id }) => id === "p0:graveyard");
    const source = board.cards.find(({ id }) => id === "st08-chain-source");

    expect(board.stacks).toHaveLength(8);
    expect(extra).toMatchObject({ count: 2, publicCount: 2 });
    expect(graveyard).toMatchObject({
      count: 1,
      publicCount: 1,
      topCardLabel: "Blue-Eyes White Dragon",
    });
    expect(board.stacks.every((stack) => !("cards" in stack))).toBe(true);
    expect(JSON.stringify(board.stacks)).not.toContain("st08-extra-one");
    expect(source?.chainLinks).toEqual([
      {
        id: "chain:1",
        index: 1,
        label: "Dark Magic Attack",
        phase: "solving",
        outcome: "normal",
      },
    ]);
    expect(JSON.stringify(board)).not.toContain("Card effect");
  });

  it("deck stacks still report their count and revealed public count", () => {
    const result = mapSnapshotToBoard(revealedDeckSnapshot(), BOARD_CARD_TEXTS);
    if (!result.ok) throw new Error("Fixture failed to map");

    expect(
      result.value.stacks.find(({ id }) => id === "p0:deck"),
    ).toMatchObject({ count: 40, publicCount: 1 });
  });

  it("deck stacks never expose a top card", () => {
    const result = mapSnapshotToBoard(revealedDeckSnapshot(), BOARD_CARD_TEXTS);
    if (!result.ok) throw new Error("Fixture failed to map");
    const deck = result.value.stacks.find(({ id }) => id === "p0:deck");

    expect(deck?.topCardLabel).toBeUndefined();
    expect(deck?.topCardCode).toBeUndefined();
  });

  it("graveyard stacks still expose their top card", () => {
    const result = mapSnapshotToBoard(
      TWO_CARD_GRAVEYARD_STATE,
      BOARD_CARD_TEXTS,
    );
    if (!result.ok) throw new Error("Fixture failed to map");
    const graveyard = result.value.stacks.find(
      ({ id }) => id === "p0:graveyard",
    );

    expect(graveyard?.topCardLabel).toBe("Blue-Eyes White Dragon");
    expect(graveyard?.topCardCode).toBe(89631139);
  });

  it("rejects duplicate physical occupancy instead of overwriting", () => {
    expect(
      mapSnapshotToBoard(DUPLICATE_SHARED_OCCUPANCY, BOARD_CARD_TEXTS),
    ).toEqual({
      ok: false,
      error: {
        type: "duplicate_physical_occupancy",
        zoneId: "shared:extraMonster:left",
        cardIds: ["duplicate-left-a", "duplicate-left-b"],
      },
    });
  });

  it("builds initial spatial neighbors for main rows, shared EMZs, and stacks", () => {
    const sparse = mappedBoard("ST-02");
    const shared = mappedBoard("ST-03");
    const stacks = mappedBoard("ST-08");

    expect(sparse.nav.get("card:st02-main-zero")?.right).toBe(
      "zone:p0:mainMonster:1",
    );
    expect(sparse.nav.get("card:st02-main-four")?.left).toBe(
      "zone:p0:mainMonster:3",
    );
    expect(shared.nav.get("card:st03-shared-left")?.right).toBe(
      "card:st03-shared-right",
    );
    expect(stacks.nav.get("stack:p0:deck")?.up).toBe("stack:p0:graveyard");
    expect(stacks.nav.get("stack:p0:deck")?.left).toBe("zone:p0:spellTrap:4");
  });

  it("hidden hand placeholders are upright", () => {
    const result = mapSnapshotToBoard(RICH_PUBLIC_DUEL_STATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opponentHiddenHand = result.value.cards.filter(
      (card) => card.zoneId === "p1:hand",
    );
    expect(opponentHiddenHand.length).toBeGreaterThan(0);
    expect(
      opponentHiddenHand.every((card) => card.orientation === "upright"),
    ).toBe(true);
  });

  it("hidden hand placeholders are not defense position", () => {
    const result = mapSnapshotToBoard(RICH_PUBLIC_DUEL_STATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opponentHiddenHand = result.value.cards.filter(
      (card) => card.zoneId === "p1:hand",
    );
    expect(opponentHiddenHand.length).toBeGreaterThan(0);
    expect(
      opponentHiddenHand.every((card) => card.position === "faceDownAttack"),
    ).toBe(true);
  });

  it("own hidden hand placeholders are upright too", () => {
    const snapshot = {
      ...RICH_PUBLIC_DUEL_STATE,
      players: [
        { ...RICH_PUBLIC_DUEL_STATE.players[0], handCount: 2 },
        RICH_PUBLIC_DUEL_STATE.players[1],
      ],
    } as typeof RICH_PUBLIC_DUEL_STATE;
    const result = mapSnapshotToBoard(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ownHiddenHand = result.value.cards.filter(
      (card) => card.zoneId === "p0:hand" && card.hidden,
    );
    expect(ownHiddenHand.length).toBeGreaterThan(0);
    expect(ownHiddenHand.every((card) => card.orientation === "upright")).toBe(
      true,
    );
  });

  it("resolves each prompt choice to stable board target or explicit fallback", () => {
    const snapshot = BOARD_VIEW_MODEL_FIXTURES["ST-08"];
    const board = mappedBoard("ST-08");

    expect(
      BOARD_TARGET_PROMPT.choices.map((choice) =>
        resolvePromptChoiceBoardTarget(choice, snapshot, board),
      ),
    ).toEqual([
      { kind: "board", targetId: "card:st08-chain-source" },
      { kind: "stack", targetId: "stack:p0:graveyard" },
      { kind: "board", targetId: "zone:p0:field" },
      { kind: "nonField", reason: "unsupported_field_address" },
      { kind: "nonField", reason: "choice_has_no_field_target" },
    ]);
    expect(
      resolvePromptChoiceBoardTarget(
        promptChoice("mounted-card"),
        snapshot,
        board,
      ),
    ).toEqual({ kind: "board", targetId: "card:st08-chain-source" });
  });
});
