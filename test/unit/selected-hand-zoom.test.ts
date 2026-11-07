import { describe, expect, it } from "vitest";
import {
  selectedHandZoomCandidates,
  trackLatestSelectedTarget,
} from "../../src/battle/app/presentation/selected-hand-zoom.ts";
import {
  cardCode,
  cardInstanceId,
} from "../../src/battle/duel/contracts/ids.ts";
import type {
  BoardCardView,
  BoardTargetId,
} from "../../src/battle/field/board-view-model.ts";

function card(
  id: string,
  overrides: Partial<BoardCardView> = {},
): BoardCardView {
  return {
    id,
    targetId: `card:${id}` as const,
    instanceId: cardInstanceId(id),
    code: cardCode(97590747),
    player: 0,
    owner: 0,
    zoneId: "p0:hand",
    sequence: 0,
    position: "faceDownDefense",
    orientation: "upright",
    facing: "self",
    hidden: false,
    label: `Card ${id}`,
    x: 0,
    y: 0,
    width: 72 / 1280,
    height: 104 / 720,
    counters: [],
    materials: [],
    chainLinks: [],
    image: { kind: "face", code: cardCode(97590747) },
    ...overrides,
  };
}

function targets(...ids: readonly string[]): ReadonlySet<BoardTargetId> {
  return new Set(ids.map((id) => `card:${id}` as BoardTargetId));
}

describe("selectedHandZoomCandidates", () => {
  it("keeps the selected cards that sit in player 0's hand", () => {
    const cards = [card("hand-one"), card("hand-two")];

    expect(
      selectedHandZoomCandidates(cards, targets("hand-one")).map(
        ({ id }) => id,
      ),
    ).toEqual(["hand-one"]);
  });

  it("ignores a selected card that is not in a hand", () => {
    const cards = [
      card("monster", { zoneId: "p0:mainMonster:0", position: "faceUpAttack" }),
    ];

    expect(selectedHandZoomCandidates(cards, targets("monster"))).toEqual([]);
  });

  /* The overlay may never publish an identity the player cannot already see,
     so the opponent's hand zone is out whatever a spec put in the set, and so
     is any card the projection handed over without a code. */
  it("ignores the opponent's hand", () => {
    const cards = [card("opponent-hand", { player: 1, zoneId: "p1:hand" })];

    expect(selectedHandZoomCandidates(cards, targets("opponent-hand"))).toEqual(
      [],
    );
  });

  it("ignores a hand card whose identity is concealed", () => {
    /* Deleted rather than set to undefined: the projection omits `code`
       entirely for a card whose identity it may not publish. */
    const concealed = {
      ...card("hidden-hand"),
      hidden: true,
      image: { kind: "back" as const },
    };
    Reflect.deleteProperty(concealed, "code");
    const cards: readonly BoardCardView[] = [concealed];

    expect(selectedHandZoomCandidates(cards, targets("hidden-hand"))).toEqual(
      [],
    );
  });
});

describe("trackLatestSelectedTarget", () => {
  const one = "card:hand-one" as BoardTargetId;
  const two = "card:hand-two" as BoardTargetId;

  it("takes the target the latest change added", () => {
    expect(trackLatestSelectedTarget([one], [one, two], one)).toBe(two);
  });

  it("keeps the current target while nothing was added", () => {
    expect(trackLatestSelectedTarget([one, two], [one, two], one)).toBe(one);
  });

  it("falls back to a still-selected target when the served one goes", () => {
    expect(trackLatestSelectedTarget([one, two], [two], one)).toBe(two);
  });

  it("reports nothing once the selection empties", () => {
    expect(trackLatestSelectedTarget([one], [], one)).toBeNull();
  });

  /* A prompt can arrive with picks already made, and a set has no order to
     read them in: the last one listed is the deterministic answer. */
  it("takes the last of several targets added at once", () => {
    expect(trackLatestSelectedTarget([], [one, two], null)).toBe(two);
  });
});
