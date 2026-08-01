import { describe, expect, it } from "vitest";
import {
  cardCode,
  cardInstanceId,
  choiceId,
  promptId,
  snapshotId,
} from "../../src/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/duel/contracts/player-prompt.ts";
import type { PublicDuelState } from "../../src/duel/contracts/public-duel-state.ts";
import {
  fieldCardChoices,
  fieldZoneChoice,
  fieldZoneChoices,
  mapSnapshotToField,
  promptFieldTargets,
  reconcileFieldKeys,
} from "../../src/field/card-mapping.ts";
import {
  createDuelFieldLayout,
  fieldZoneId,
  mapEngineFieldAddress,
  STANDARD_DUEL_FIELD_LAYOUT,
  type EngineFieldAddress,
  type PhysicalZoneId,
} from "../../src/field/duel-field-layout.ts";

const state: PublicDuelState = {
  snapshotId: snapshotId("a".repeat(64)),
  revision: 1,
  turn: 1,
  turnPlayer: 0,
  phase: "main1",
  players: [
    {
      player: 0,
      lifePoints: 8000,
      deckCount: 35,
      extraDeckCount: 0,
      handCount: 1,
      hand: [
        {
          instanceId: cardInstanceId("human-hand"),
          code: cardCode(97590747),
          owner: 0,
          controller: 0,
          location: "hand",
          sequence: 0,
          position: "faceDownDefense",
          faceUp: false,
          counters: [],
          overlayMaterials: [],
        },
      ],
      extraDeck: [],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
    },
    {
      player: 1,
      lifePoints: 8000,
      deckCount: 35,
      extraDeckCount: 0,
      handCount: 2,
      hand: [],
      extraDeck: [],
      monsters: [
        {
          instanceId: cardInstanceId("opponent-monster"),
          code: cardCode(89631139),
          owner: 1,
          controller: 1,
          location: "monster",
          sequence: 0,
          position: "faceUpAttack",
          faceUp: true,
          counters: [],
          overlayMaterials: [],
        },
      ],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
    },
  ],
  chain: [],
};

const prompt: PlayerPrompt = {
  id: promptId("field-prompt"),
  kind: "selectCard",
  player: 0,
  title: "Choose",
  choices: [
    {
      id: choiceId("monster-choice"),
      label: "Opponent monster",
      action: "select",
      card: {
        instanceId: cardInstanceId("prompt-positional-id"),
        code: cardCode(89631139),
        controller: 1,
        location: "monster",
        sequence: 0,
        position: "faceUpAttack",
      },
    },
  ],
  minimum: 1,
  maximum: 1,
  cancelable: false,
  ordered: false,
};

describe("duel field mapping", () => {
  it("creates 34 unique Standard physical controls with two shared EMZs", () => {
    const layout = STANDARD_DUEL_FIELD_LAYOUT;
    expect(createDuelFieldLayout()).toEqual(createDuelFieldLayout());
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
    expect(createDuelFieldLayout()).toContainEqual(
      expect.objectContaining({
        id: "p0:mainMonster:0",
        x: 440,
        y: 470,
        width: 82,
        height: 114,
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

  it("maps sparse main slots 0 and 4 without resequencing", () => {
    const sparseState: PublicDuelState = {
      ...state,
      players: [
        {
          ...state.players[0],
          monsters: [
            {
              instanceId: cardInstanceId("main-zero"),
              code: cardCode(97590747),
              owner: 0,
              controller: 0,
              location: "monster",
              sequence: 0,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
            {
              instanceId: cardInstanceId("main-four"),
              code: cardCode(5053103),
              owner: 0,
              controller: 0,
              location: "monster",
              sequence: 4,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
          ],
        },
        state.players[1],
      ],
    };

    const mapped = mapSnapshotToField(sparseState);
    expect(mapped.cards.get("main-zero")).toMatchObject({
      sequence: 0,
      x: 440,
      y: 470,
    });
    expect(mapped.cards.get("main-four")).toMatchObject({
      sequence: 4,
      x: 840,
      y: 470,
    });
  });

  it("maps both shared EMZs and omits invalid fixed cards", () => {
    const sharedState: PublicDuelState = {
      ...state,
      players: [
        {
          ...state.players[0],
          monsters: [
            {
              instanceId: cardInstanceId("p0-left-emz"),
              code: cardCode(97590747),
              owner: 0,
              controller: 0,
              location: "monster",
              sequence: 5,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
            {
              instanceId: cardInstanceId("invalid-monster"),
              code: cardCode(5053103),
              owner: 0,
              controller: 0,
              location: "monster",
              sequence: 7,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
          ],
        },
        {
          ...state.players[1],
          monsters: [
            {
              instanceId: cardInstanceId("p1-right-emz"),
              code: cardCode(89631139),
              owner: 1,
              controller: 1,
              location: "monster",
              sequence: 5,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
          ],
        },
      ],
    };

    const mapped = mapSnapshotToField(sharedState);
    const p0 = mapped.cards.get("p0-left-emz");
    const p1 = mapped.cards.get("p1-right-emz");
    expect(p0).toMatchObject({ sequence: 5, x: 590, y: 360 });
    expect(p1).toMatchObject({ sequence: 5, x: 690, y: 360 });
    expect(mapped.cards.has("invalid-monster")).toBe(false);
  });

  it("resolves equal-sequence Field and Spell/Trap cards by location", () => {
    const fieldState: PublicDuelState = {
      ...state,
      players: [
        {
          ...state.players[0],
          spellsAndTraps: [
            {
              instanceId: cardInstanceId("spell-trap-zero"),
              code: cardCode(97590747),
              owner: 0,
              controller: 0,
              location: "spellTrap",
              sequence: 0,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
            {
              instanceId: cardInstanceId("field-zero"),
              code: cardCode(5053103),
              owner: 0,
              controller: 0,
              location: "field",
              sequence: 0,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
            {
              instanceId: cardInstanceId("invalid-spell-trap-five"),
              code: cardCode(46986414),
              owner: 0,
              controller: 0,
              location: "spellTrap",
              sequence: 5,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
            {
              instanceId: cardInstanceId("invalid-field-one"),
              code: cardCode(44519536),
              owner: 0,
              controller: 0,
              location: "field",
              sequence: 1,
              position: "faceUpAttack",
              faceUp: true,
              counters: [],
              overlayMaterials: [],
            },
          ],
        },
        state.players[1],
      ],
    };
    const fieldPrompt: PlayerPrompt = {
      ...prompt,
      choices: [
        {
          id: choiceId("field-card-choice"),
          label: "Field card",
          action: "select",
          card: {
            instanceId: cardInstanceId("positional-field"),
            code: cardCode(5053103),
            controller: 0,
            location: "field",
            sequence: 0,
            position: "faceUpAttack",
          },
        },
      ],
    };

    const mapped = mapSnapshotToField(fieldState);
    const spellTrap = mapped.cards.get("spell-trap-zero");
    const field = mapped.cards.get("field-zero");
    expect(spellTrap).toMatchObject({ zone: "spellTrap", sequence: 0 });
    expect(field).toMatchObject({ zone: "field", sequence: 0 });
    expect([spellTrap?.x, spellTrap?.y]).not.toEqual([field?.x, field?.y]);
    expect(mapped.cards.has("invalid-spell-trap-five")).toBe(false);
    expect(mapped.cards.has("invalid-field-one")).toBe(false);
    expect(promptFieldTargets(fieldPrompt, fieldState).cardIds).toEqual(
      new Set(["field-zero"]),
    );
  });

  it("maps valid prompt places to physical IDs and omits invalid places", () => {
    const placePrompt: PlayerPrompt = {
      id: promptId("place-prompt"),
      kind: "selectPlace",
      player: 0,
      title: "Choose a zone",
      choices: [
        {
          id: choiceId("left-emz-p0"),
          label: "Left EMZ",
          action: "select",
          place: { player: 0, location: "monster", sequence: 5 },
        },
        {
          id: choiceId("left-emz-p1"),
          label: "Left EMZ alias",
          action: "select",
          place: { player: 1, location: "monster", sequence: 6 },
        },
        {
          id: choiceId("field-zone"),
          label: "Field Zone",
          action: "select",
          place: { player: 0, location: "field", sequence: 0 },
        },
        {
          id: choiceId("pendulum-zone"),
          label: "Pendulum Zone",
          action: "select",
          place: { player: 0, location: "pendulum", sequence: 1 },
        },
        {
          id: choiceId("invalid-zone"),
          label: "Invalid Zone",
          action: "select",
          place: { player: 0, location: "spellTrap", sequence: 5 },
        },
      ],
      minimum: 1,
      maximum: 1,
      cancelable: false,
      ordered: false,
    };

    expect(promptFieldTargets(placePrompt, null).zoneIds).toEqual(
      new Set(["shared:extraMonster:left", "p0:field", "p0:spellTrap:4"]),
    );
    expect(
      fieldZoneChoices(placePrompt, "shared:extraMonster:left").map(
        ({ id }) => id,
      ),
    ).toEqual(["left-emz-p0", "left-emz-p1"]);
    expect(
      fieldZoneChoice(placePrompt, "shared:extraMonster:left"),
    ).toBeUndefined();
    expect(fieldZoneChoice(placePrompt, "p0:field")?.id).toBe("field-zone");
    expect(fieldZoneChoice(placePrompt, "p0:spellTrap:4")?.id).toBe(
      "pendulum-zone",
    );
    expect(fieldZoneChoice(placePrompt, "p0:spellTrap:0")).toBeUndefined();
  });

  it("maps snapshots idempotently with hidden opponent-hand placeholders", () => {
    const first = mapSnapshotToField(state);
    const second = mapSnapshotToField(state);
    expect([...first.cards]).toEqual([...second.cards]);
    expect(first.cards.get("human-hand")).toMatchObject({ hidden: false });
    expect(first.cards.get("opponent-hand-0")).toMatchObject({ hidden: true });
    expect(first.cards.get("opponent-hand-1")).toMatchObject({ hidden: true });
    expect(first.cards).toHaveLength(4);
  });

  it("resolves positional prompt cards to public field instances", () => {
    const targets = promptFieldTargets(prompt, state);
    expect(targets.cardIds).toEqual(new Set(["opponent-monster"]));
    expect(
      fieldCardChoices(prompt, state, "opponent-monster").map(({ id }) => id),
    ).toEqual(["monster-choice"]);
  });

  it("reconciles only new and removed presentation keys", () => {
    expect(
      reconcileFieldKeys(new Set(["keep", "remove"]), new Set(["keep", "add"])),
    ).toEqual({ create: ["add"], remove: ["remove"] });
  });
});
