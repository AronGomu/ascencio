import { describe, expect, it } from "vitest";
import {
  createFieldNavigationState,
  reduceFieldNavigation,
} from "../../src/battle/app/prompts/field-navigation.ts";
import {
  mapSnapshotToBoard,
  type BoardTargetId,
  type BoardViewModel,
} from "../../src/battle/field/board-view-model.ts";
import { createFieldRenderLayout } from "../../src/battle/field/duel-field-geometry.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
  LINK_FREE_STATE,
} from "../fixtures/board-view-model.ts";

function board(state: keyof typeof BOARD_VIEW_MODEL_FIXTURES) {
  const result = mapSnapshotToBoard(
    BOARD_VIEW_MODEL_FIXTURES[state],
    BOARD_CARD_TEXTS,
  );
  if (!result.ok)
    throw new Error(`Fixture mapping failed: ${result.error.type}`);
  return result.value;
}

function linkFreeBoard(): BoardViewModel {
  const result = mapSnapshotToBoard(LINK_FREE_STATE, BOARD_CARD_TEXTS);
  if (!result.ok)
    throw new Error(`Link-free mapping failed: ${result.error.type}`);
  return result.value;
}

function reachableTargets(value: BoardViewModel): ReadonlySet<BoardTargetId> {
  const targets = [...value.nav.keys()];
  const start = targets[0];
  if (start === undefined) throw new Error("Empty nav map");
  const reached = new Set<BoardTargetId>([start]);
  const queue: BoardTargetId[] = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const from = queue[index]!;
    for (const key of [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ] as const) {
      const moved = reduceFieldNavigation(synchronize(value, [from]), {
        type: "move",
        board: value,
        key,
      }).activeTarget;
      if (moved !== null && !reached.has(moved)) {
        reached.add(moved);
        queue.push(moved);
      }
    }
  }
  return reached;
}

function synchronize(
  value = board("ST-02"),
  actionableTargets: readonly (typeof value.nav extends ReadonlyMap<
    infer K,
    unknown
  >
    ? K
    : never)[] = [],
  context = "prompt-1",
) {
  return reduceFieldNavigation(createFieldNavigationState(), {
    type: "synchronize",
    board: value,
    actionableTargets: new Set(actionableTargets),
    context,
  });
}

function sharedExtraMonsterTargets(
  value: BoardViewModel,
): readonly BoardTargetId[] {
  return [...value.nav.keys()].filter((target) => {
    const zone = value.zones.find(({ targetId }) => targetId === target);
    if (zone !== undefined) return zone.player === "shared";
    return (
      value.cards
        .find(({ targetId }) => targetId === target)
        ?.zoneId.startsWith("shared:") === true
    );
  });
}

describe("field navigation", () => {
  it("moves with arrows plus Home/End across occupied and empty row controls", () => {
    const value = board("ST-02");
    let state = synchronize(value, ["card:st02-main-zero"]);
    expect(state.activeTarget).toBe("card:st02-main-zero");

    state = reduceFieldNavigation(state, {
      type: "move",
      board: value,
      key: "ArrowRight",
    });
    expect(state.activeTarget).toBe("zone:p0:mainMonster:1");

    state = reduceFieldNavigation(state, {
      type: "move",
      board: value,
      key: "End",
    });
    expect(state.activeTarget).toBe("stack:p0:banished");

    state = reduceFieldNavigation(state, {
      type: "move",
      board: value,
      key: "Home",
    });
    expect(state.activeTarget).toBe("zone:p0:field");
  });

  it("uses graph adjacency for stacks and shared Extra Monster Zones", () => {
    const stacks = board("ST-08");
    let state = synchronize(stacks, ["stack:p0:deck"]);
    state = reduceFieldNavigation(state, {
      type: "move",
      board: stacks,
      key: "ArrowUp",
    });
    expect(state.activeTarget).toBe("stack:p0:graveyard");

    const shared = board("ST-03");
    state = synchronize(shared, ["card:st03-shared-left"], "prompt-2");
    state = reduceFieldNavigation(state, {
      type: "move",
      board: shared,
      key: "ArrowRight",
    });
    expect(state.activeTarget).toBe("card:st03-shared-right");
  });

  it("moves within hands and reaches row edges with Home/End", () => {
    const value = board("ST-01");
    const opponentHand = value.cards
      .filter(({ zoneId }) => zoneId === "p1:hand")
      .map(({ targetId }) => targetId);
    expect(opponentHand).toHaveLength(2);
    // Opponent hand nav is mirrored (T8): nav-model "right" walks toward a
    // lower engine sequence for player 1, so starting at sequence 0 already
    // sits at that row edge and End is a no-op; Home walks the other way,
    // toward the higher sequence 1.
    let state = synchronize(value, [opponentHand[0]!]);

    state = reduceFieldNavigation(state, {
      type: "move",
      board: value,
      key: "End",
    });
    expect(state.activeTarget).toBe(opponentHand[0]);
    state = reduceFieldNavigation(state, {
      type: "move",
      board: value,
      key: "Home",
    });
    expect(state.activeTarget).toBe(opponentHand[1]);
  });

  it("keeps horizontal movement row-local so vertical keys reach hand defense cards", () => {
    const value = board("ST-01");
    const opponentHand = value.cards
      .filter(({ zoneId }) => zoneId === "p1:hand")
      .map(({ targetId }) => targetId);
    let state = synchronize(value, ["stack:p1:extra"]);

    for (let move = 0; move < 6; move += 1) {
      state = reduceFieldNavigation(state, {
        type: "move",
        board: value,
        key: "ArrowRight",
      });
    }
    expect(state.activeTarget).toBe("stack:p1:deck");

    state = reduceFieldNavigation(state, {
      type: "move",
      board: value,
      key: "ArrowRight",
    });
    expect(state.activeTarget).toBe("stack:p1:deck");

    state = reduceFieldNavigation(state, {
      type: "move",
      board: value,
      key: "ArrowUp",
    });
    expect(opponentHand).toContain(state.activeTarget);
  });

  it("reconciles empty/occupied replacements and intentional actionable prompt changes", () => {
    const empty = board("ST-01");
    let state = synchronize(empty, ["zone:p0:mainMonster:0"]);
    expect(state.activeTarget).toBe("zone:p0:mainMonster:0");

    const occupied = board("ST-05");
    state = reduceFieldNavigation(state, {
      type: "synchronize",
      board: occupied,
      actionableTargets: new Set(["card:st02-main-zero"]),
      context: "prompt-1",
    });
    expect(state.activeTarget).toBe("card:st02-main-zero");

    state = reduceFieldNavigation(state, {
      type: "synchronize",
      board: occupied,
      actionableTargets: new Set(["zone:p0:mainMonster:4"]),
      context: "prompt-2",
    });
    expect(state.activeTarget).toBe("zone:p0:mainMonster:4");

    state = reduceFieldNavigation(state, {
      type: "synchronize",
      board: occupied,
      actionableTargets: new Set(),
      context: "prompt-3",
    });
    expect(state.activeTarget).toBe("zone:p0:mainMonster:4");
  });

  it("keeps every field target reachable with arrow keys alone", () => {
    for (const fixture of ["ST-01", "ST-03", "ST-08"] as const) {
      const value = board(fixture);
      const targets = [...value.nav.keys()];
      const reached = reachableTargets(value);
      expect({
        fixture,
        unreachable: targets.filter((target) => !reached.has(target)),
      }).toEqual({ fixture, unreachable: [] });
      expect(sharedExtraMonsterTargets(value).length).toBe(2);
    }
  });

  it("keeps every remaining target reachable when the shared zones are gone", () => {
    const value = linkFreeBoard();
    const targets = [...value.nav.keys()];
    const reached = reachableTargets(value);

    expect(targets).toHaveLength(32);
    expect(targets.filter((target) => !reached.has(target))).toEqual([]);
    expect(sharedExtraMonsterTargets(value)).toEqual([]);
  });

  it("keeps navigation stable across render viewport sizes", () => {
    createFieldRenderLayout(true, 886, 768);
    const small = board("ST-05");
    createFieldRenderLayout(true, 1872, 1440);
    const large = board("ST-05");

    expect([...small.nav]).toEqual([...large.nav]);
  });

  it("keeps responsive composition separate from physical nav adjacency", () => {
    const value = board("ST-05");
    const route = (context: string) => {
      let state = synchronize(value, ["card:st02-main-zero"], context);
      for (const key of ["ArrowRight", "ArrowRight", "ArrowDown"] as const) {
        state = reduceFieldNavigation(state, {
          type: "move",
          board: value,
          key,
        });
      }
      return state.activeTarget;
    };

    expect(route("desktop-layout")).toBe(route("compact-layout"));
    expect(route("compact-layout")).toBe(route("portrait-layout"));
  });
});
