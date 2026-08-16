import { describe, expect, it } from "vitest";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
import type { PublicDuelState } from "../../src/battle/duel/contracts/public-duel-state.ts";
import { resolvePromptChoiceBoardTarget } from "../../src/battle/field/card-mapping.ts";
import {
  mapSnapshotToBoard,
  type BoardViewModel,
} from "../../src/battle/field/board-view-model.ts";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  DUEL_FIELD_HEIGHT,
  DUEL_FIELD_WIDTH,
  fieldZoneAccessibleName,
  fieldZoneId,
  mapEngineFieldAddress,
  STANDARD_DUEL_FIELD_LAYOUT,
  type EngineFieldAddress,
  type PhysicalZoneId,
} from "../../src/battle/field/duel-field-layout.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_TARGET_PROMPT,
  BOARD_VIEW_MODEL_FIXTURES,
  DUPLICATE_SHARED_OCCUPANCY,
  LINK_FREE_OCCUPIED_SHARED_STATE,
  LINK_FREE_STATE,
  SHARED_CARD_PROMPT,
  SHARED_PLACE_PROMPT,
  TWO_CARD_GRAVEYARD_STATE,
  promptChoice,
} from "../fixtures/board-view-model.ts";
import {
  concealedStateCard,
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
        x: 450 / 1280,
        y: 470 / 720,
        width: 82 / 1280,
        height: 114 / 720,
      }),
    );
  });

  it("uses requested owner-neutral visible labels", () => {
    const playerZones = STANDARD_DUEL_FIELD_LAYOUT.filter(
      ({ player }) => player !== "shared",
    );
    expect(
      playerZones.some(({ label }) => /^(Your|Opponent) /.test(label)),
    ).toBe(false);
    expect(
      playerZones
        .filter(({ player, kind }) => player === 0 && kind === "monster")
        .map(({ label }) => label),
    ).toEqual([
      "Monster Zone 1",
      "Monster Zone 2",
      "Monster Zone 3",
      "Monster Zone 4",
      "Monster Zone 5",
    ]);
    expect(
      playerZones
        .filter(({ player, kind }) => player === 0 && kind === "spellTrap")
        .map(({ label }) => label),
    ).toEqual([
      "Spell/Trap Zone 1",
      "Spell/Trap Zone 2",
      "Spell/Trap Zone 3",
      "Spell/Trap Zone 4",
      "Spell/Trap Zone 5",
    ]);
    expect(
      STANDARD_DUEL_FIELD_LAYOUT.filter(
        ({ player }) => player === "shared",
      ).map(({ label }) => label),
    ).toEqual([
      "Shared Extra Monster Zone left",
      "Shared Extra Monster Zone right",
    ]);
  });

  /* R1/F7 property, not a restatement of the constants: no painted zone may
     collide with another.

     Scope decision (evidence, not preference): `p{n}:hand` is excluded because
     T8 made it a virtual, navigation-only rectangle. `FieldBoard.svelte:59`
     filters `kind === "hand"` out of the painted `ZoneControl`s, and
     `.duel-field-hand-band` consumes `--field-x/--field-y/--field-width` only
     — it never reads `--field-height` and paints no border or background. The
     record survives solely to place the band and to anchor spatial navigation,
     so its 462x72 box overlapping the backrow by 5 design px paints nothing.

     For every painted zone the property is strict, and it is stated on the
     card footprint each box exists to hold: `CARD_WIDTH x CARD_HEIGHT` at the
     zone centre. Each layout box adds a 5px chrome halo per side, so "card
     footprint gap >= 0" is exactly "boxes overlap by no more than the chrome
     they add". The shared EMZ row is centred between the two main-monster rows
     (110px away from each, against the 114px box height), so its halo does
     overlap those rows by 4px — chrome only; the cards keep a 6px gap. Item
     16's accepted spacing (column pitch 95, row pitch 120) must not be moved
     to erase a chrome seam. */
  it("no painted zone footprint overlaps another", () => {
    const painted = STANDARD_DUEL_FIELD_LAYOUT.filter(
      ({ kind }) => kind !== "hand",
    );
    expect(painted).toHaveLength(32);

    const footprint = (zone: (typeof painted)[number]) => ({
      id: zone.id,
      left: zone.x * DUEL_FIELD_WIDTH - CARD_WIDTH / 2,
      right: zone.x * DUEL_FIELD_WIDTH + CARD_WIDTH / 2,
      top: zone.y * DUEL_FIELD_HEIGHT - CARD_HEIGHT / 2,
      bottom: zone.y * DUEL_FIELD_HEIGHT + CARD_HEIGHT / 2,
    });
    const boxes = painted.map(footprint);
    const collisions: string[] = [];
    for (let index = 0; index < boxes.length; index += 1) {
      for (let other = index + 1; other < boxes.length; other += 1) {
        const left = boxes[index]!;
        const right = boxes[other]!;
        const horizontalGap = Math.max(
          left.left - right.right,
          right.left - left.right,
        );
        const verticalGap = Math.max(
          left.top - right.bottom,
          right.top - left.bottom,
        );
        if (horizontalGap < 0 && verticalGap < 0)
          collisions.push(
            `${left.id} x ${right.id} (${-horizontalGap}px by ${-verticalGap}px)`,
          );
      }
    }

    expect(collisions).toEqual([]);
  });

  it("retains owner-aware accessible names", () => {
    const byId = new Map(
      STANDARD_DUEL_FIELD_LAYOUT.map((zone) => [zone.id, zone]),
    );
    expect(fieldZoneAccessibleName(byId.get("p0:mainMonster:0")!)).toBe(
      "Your Monster Zone 1",
    );
    expect(fieldZoneAccessibleName(byId.get("p1:spellTrap:4")!)).toBe(
      "Opponent Spell and Trap Zone 5",
    );
    expect(fieldZoneAccessibleName(byId.get("shared:extraMonster:left")!)).toBe(
      "Shared Extra Monster Zone left",
    );
    expect(fieldZoneAccessibleName(byId.get("p0:graveyard")!)).toBe(
      "Your Graveyard",
    );
  });

  it("uses denser columns and wider row gaps", () => {
    const byId = new Map(
      STANDARD_DUEL_FIELD_LAYOUT.map((zone) => [zone.id, zone]),
    );
    for (const player of [0, 1] as const) {
      expect(
        [0, 1, 4].map(
          (sequence) =>
            byId.get(`p${player}:mainMonster:${sequence}` as PhysicalZoneId)?.x,
        ),
      ).toEqual([450 / 1280, 545 / 1280, 830 / 1280]);
    }
    expect(byId.get("p0:spellTrap:0")?.y).toBe(590 / 720);
    expect(byId.get("p1:spellTrap:0")?.y).toBe(130 / 720);
    expect(byId.get("p0:mainMonster:0")?.y).toBe(470 / 720);
  });

  it("aligns each Extra Deck under its Field Zone", () => {
    const byId = new Map(
      STANDARD_DUEL_FIELD_LAYOUT.map((zone) => [zone.id, zone]),
    );
    for (const player of [0, 1] as const) {
      expect(byId.get(`p${player}:extra`)?.x).toBe(330 / 1280);
      expect(byId.get(`p${player}:extra`)?.x).toBe(
        byId.get(`p${player}:field`)?.x,
      );
    }
    expect(byId.get("p0:extra")?.y).toBe(590 / 720);
    expect(byId.get("p1:extra")?.y).toBe(130 / 720);
  });

  it("keeps dimensions, ids and shared EMZ coordinates stable", () => {
    expect(
      new Set(STANDARD_DUEL_FIELD_LAYOUT.map(({ id }) => id)),
    ).toHaveLength(34);
    expect(
      STANDARD_DUEL_FIELD_LAYOUT.filter(({ kind }) => kind !== "hand").every(
        ({ width, height }) => width === 82 / 1280 && height === 114 / 720,
      ),
    ).toBe(true);
    expect(
      STANDARD_DUEL_FIELD_LAYOUT.filter(
        ({ player }) => player === "shared",
      ).map(({ x, y }) => [x, y]),
    ).toEqual([
      [590 / 1280, 360 / 720],
      [690 / 1280, 360 / 720],
    ]);
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
    [{ player: 0, location: "spellTrap", sequence: 5 }, "p0:field"],
    [{ player: 1, location: "spellTrap", sequence: 5 }, "p1:field"],
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
    { player: 0, location: "spellTrap", sequence: 6 },
    { player: 1, location: "spellTrap", sequence: 6 },
    { player: 0, location: "spellTrap", sequence: 7 },
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

/**
 * ocgcore keeps the Field Zone inside the Spell & Trap list at sequence 5,
 * so a projected field spell arrives as `spellTrap` 5 rather than `field` 0.
 */
function fieldSpellSnapshot(sequence: number): PublicDuelState {
  return {
    ...RICH_PUBLIC_DUEL_STATE,
    players: [
      {
        ...RICH_PUBLIC_DUEL_STATE.players[0],
        spellsAndTraps: [
          publicStateCard(
            "grand-spellbook-tower",
            33981008,
            0,
            "spellTrap",
            sequence,
            "faceUpAttack",
          ),
        ],
      },
      RICH_PUBLIC_DUEL_STATE.players[1],
    ],
  };
}

describe("semantic board view model", () => {
  it("maps a field spell reported at spellTrap sequence 5 into the field zone", () => {
    const result = mapSnapshotToBoard(fieldSpellSnapshot(5), BOARD_CARD_TEXTS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.cards.find(({ id }) => id === "grand-spellbook-tower"),
    ).toMatchObject({ zoneId: "p0:field", sequence: 5, hidden: false });
  });

  it("still rejects spellTrap sequences 6 and 7", () => {
    for (const sequence of [6, 7]) {
      expect(
        mapSnapshotToBoard(fieldSpellSnapshot(sequence), BOARD_CARD_TEXTS),
      ).toEqual({
        ok: false,
        error: {
          type: "unsupported_fixed_card",
          cardId: "grand-spellbook-tower",
          controller: 0,
          location: "spellTrap",
          sequence,
        },
      });
    }
  });

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

  it("carries known code while rendering a face-down card back", () => {
    const knownCard = publicStateCard(
      "known-face-down",
      5053103,
      1,
      "monster",
      0,
      "faceDownDefense",
    );
    const known: PublicDuelState = {
      ...RICH_PUBLIC_DUEL_STATE,
      players: [
        RICH_PUBLIC_DUEL_STATE.players[0],
        { ...RICH_PUBLIC_DUEL_STATE.players[1], monsters: [knownCard] },
      ],
    };
    const result = mapSnapshotToBoard(known, BOARD_CARD_TEXTS);
    if (!result.ok) throw new Error("Known face-down fixture failed to map");
    const mapped = result.value.cards.find(
      ({ id }) => id === knownCard.instanceId,
    );

    expect(mapped).toMatchObject({
      code: cardCode(5053103),
      hidden: true,
      image: { kind: "back" },
      label: expect.stringContaining("Axe Raider"),
      position: "faceDownDefense",
    });
  });

  it("renders an unknown face-down card with back art", () => {
    const unknownCard = concealedStateCard(
      "unknown-face-down",
      1,
      "monster",
      0,
    );
    const unknown: PublicDuelState = {
      ...RICH_PUBLIC_DUEL_STATE,
      players: [
        RICH_PUBLIC_DUEL_STATE.players[0],
        { ...RICH_PUBLIC_DUEL_STATE.players[1], monsters: [unknownCard] },
      ],
    };
    const result = mapSnapshotToBoard(unknown, BOARD_CARD_TEXTS);
    if (!result.ok) throw new Error("Unknown face-down fixture failed to map");
    const mapped = result.value.cards.find(
      ({ id }) => id === unknownCard.instanceId,
    );

    expect(mapped).toMatchObject({
      hidden: true,
      image: { kind: "back" },
      position: "faceDownDefense",
    });
    expect(mapped).not.toHaveProperty("code");
    expect(mapped?.label).not.toContain("Axe Raider");
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
      "Dark Magician in Your Monster Zone 3, face-down attack",
    );
    expect(board.cards[2]?.image).toEqual({ kind: "back" });
    expect(board.cards[2]?.code).toBe(cardCode(46986414));
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

  it("keeps 34 zones with both shared EMZs for a Link profile", () => {
    const result = mapSnapshotToBoard(
      BOARD_VIEW_MODEL_FIXTURES["ST-03"],
      BOARD_CARD_TEXTS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.zones).toHaveLength(34);
    expect(
      result.value.zones.filter(({ player }) => player === "shared"),
    ).toHaveLength(2);
    expect(result.value.nav.has("card:st03-shared-left")).toBe(true);
  });

  it("drops both shared EMZs from zones, cards and nav for a Link-free profile", () => {
    const result = mapSnapshotToBoard(LINK_FREE_STATE, BOARD_CARD_TEXTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.zones).toHaveLength(32);
    expect(
      result.value.zones.filter(({ player }) => player === "shared"),
    ).toEqual([]);
    expect(
      result.value.cards.filter(({ zoneId }) =>
        zoneId.startsWith("shared:extraMonster"),
      ),
    ).toEqual([]);
    expect(
      [...result.value.nav.keys()].filter((target) =>
        target.includes("shared:extraMonster"),
      ),
    ).toEqual([]);
    for (const neighbors of result.value.nav.values()) {
      for (const neighbor of Object.values(neighbors))
        expect(neighbor).not.toContain("shared:extraMonster");
    }
  });

  it("reports an occupied shared zone under a Link-free profile as a conflict", () => {
    expect(
      mapSnapshotToBoard(LINK_FREE_OCCUPIED_SHARED_STATE, BOARD_CARD_TEXTS),
    ).toEqual({
      ok: false,
      error: {
        type: "layout_profile_conflict",
        zoneId: "shared:extraMonster:left",
        source: "occupied",
      },
    });
  });

  it("reports a prompt that can still reach a shared zone as a conflict", () => {
    expect(
      mapSnapshotToBoard(
        LINK_FREE_STATE,
        BOARD_CARD_TEXTS,
        SHARED_PLACE_PROMPT,
      ),
    ).toEqual({
      ok: false,
      error: {
        type: "layout_profile_conflict",
        zoneId: "shared:extraMonster:left",
        source: "prompt",
      },
    });
    expect(
      mapSnapshotToBoard(LINK_FREE_STATE, BOARD_CARD_TEXTS, SHARED_CARD_PROMPT),
    ).toEqual({
      ok: false,
      error: {
        type: "layout_profile_conflict",
        zoneId: "shared:extraMonster:right",
        source: "prompt",
      },
    });
  });

  it("leaves a Link profile board untouched by the same prompts", () => {
    for (const prompt of [SHARED_PLACE_PROMPT, SHARED_CARD_PROMPT]) {
      const result = mapSnapshotToBoard(
        BOARD_VIEW_MODEL_FIXTURES["ST-02"],
        BOARD_CARD_TEXTS,
        prompt,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.zones).toHaveLength(34);
    }
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
