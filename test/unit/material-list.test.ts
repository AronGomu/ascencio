import { describe, expect, it } from "vitest";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
import type { BoardCardView } from "../../src/battle/field/board-view-model.ts";
import { materialListEntries } from "../../src/battle/field/material-list.ts";

function host(materials: BoardCardView["materials"]): BoardCardView {
  return {
    id: "host",
    targetId: "card:host",
    player: 0,
    zoneId: "p0:mainMonster:2",
    sequence: 2,
    position: "faceUpAttack",
    orientation: "upright",
    facing: "self",
    hidden: false,
    label: "Xyz host",
    x: 0,
    y: 0,
    width: 0.1,
    height: 0.14,
    counters: [],
    materials,
    chainLinks: [],
    image: { kind: "back" },
  };
}

describe("materialListEntries", () => {
  it("builds one entry per material in host order", () => {
    const entries = materialListEntries(
      host([
        {
          id: "m1",
          sequence: 0,
          identityVisible: true,
          code: cardCode(46986414),
          label: "A",
        },
        { id: "m2", sequence: 1, identityVisible: false, label: "B" },
      ]),
    );

    expect(entries).toEqual([
      {
        id: "host:material:m1",
        position: 1,
        controller: 0,
        location: "monster",
        sequence: 0,
        identityVisible: true,
        code: 46986414,
        label: "A",
      },
      {
        id: "host:material:m2",
        position: 2,
        controller: 0,
        location: "monster",
        sequence: 1,
        identityVisible: false,
        label: "B",
      },
    ]);
    expect(Object.isFrozen(entries)).toBe(true);
    for (const entry of entries) expect(Object.isFrozen(entry)).toBe(true);
  });

  it("omits code when identity is hidden", () => {
    const [entry] = materialListEntries(
      host([
        {
          id: "hidden",
          sequence: 3,
          identityVisible: false,
          code: cardCode(46986414),
          label: "Hidden material",
        },
      ]),
    );

    expect(entry).not.toHaveProperty("code");
    expect(entry?.identityVisible).toBe(false);
  });

  it("returns a frozen empty list for a card without materials", () => {
    const entries = materialListEntries(host([]));

    expect(entries).toEqual([]);
    expect(Object.isFrozen(entries)).toBe(true);
  });
});
