import { describe, expect, it } from "vitest";
import { choiceId, promptId } from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
  PromptPlace,
} from "../../src/duel/contracts/player-prompt.ts";
import {
  centralPlacementResponse,
  placementRank,
} from "../../src/app/prompts/auto-placement.ts";

function placeChoice(id: string, place: PromptPlace): PromptChoice {
  return { id: choiceId(id), label: id, action: "select", place };
}

function prompt(
  kind: PromptKind,
  choices: readonly PromptChoice[],
  overrides: Partial<PlayerPrompt> = {},
): PlayerPrompt {
  return {
    id: promptId(`${kind}-auto-placement`),
    kind,
    player: 0,
    title: "Choose a place",
    choices,
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  };
}

function monsterPlace(
  sequence: number,
  player: PromptPlace["player"] = 0,
): PromptPlace {
  return { player, location: "monster", sequence };
}

describe("placementRank", () => {
  it("ranks the centre monster zone first", () => {
    const ranks = [0, 1, 2, 3, 4].map((sequence) =>
      placementRank(monsterPlace(sequence)),
    );
    const sequencesByRank = [0, 1, 2, 3, 4]
      .slice()
      .sort((a, b) => ranks[a]! - ranks[b]!);
    expect(sequencesByRank).toEqual([2, 1, 3, 0, 4]);
  });

  it("ranks extra monster zones after the main row", () => {
    const extra = placementRank(monsterPlace(5));
    for (const sequence of [0, 1, 2, 3, 4])
      expect(extra).toBeGreaterThan(placementRank(monsterPlace(sequence)));
    expect(extra).toBeLessThan(placementRank(monsterPlace(6)));
  });

  it("ranks the opponent side last", () => {
    const mine = placementRank(monsterPlace(2, 0));
    const theirs = placementRank(monsterPlace(2, 1));
    expect(theirs).toBeGreaterThan(mine);
  });
});

describe("centralPlacementResponse", () => {
  it("picks the central place", () => {
    const value = prompt("selectPlace", [
      placeChoice("a", monsterPlace(0)),
      placeChoice("b", monsterPlace(2)),
      placeChoice("c", monsterPlace(4)),
    ]);
    expect(centralPlacementResponse(value)).toEqual([choiceId("b")]);
  });

  it("falls back to the next most central", () => {
    const value = prompt("selectPlace", [
      placeChoice("a", monsterPlace(0)),
      placeChoice("b", monsterPlace(3)),
      placeChoice("c", monsterPlace(4)),
    ]);
    expect(centralPlacementResponse(value)).toEqual([choiceId("b")]);
  });

  it("ignores prompts that are not selectPlace", () => {
    const value = prompt("selectDisabledField", [
      placeChoice("a", monsterPlace(0)),
    ]);
    expect(centralPlacementResponse(value)).toBeNull();
  });

  it("ignores multi-place prompts", () => {
    const value = prompt(
      "selectPlace",
      [placeChoice("a", monsterPlace(0)), placeChoice("b", monsterPlace(2))],
      { minimum: 2, maximum: 2 },
    );
    expect(centralPlacementResponse(value)).toBeNull();
  });

  it("ignores prompts addressed to the opponent", () => {
    const value = prompt(
      "selectPlace",
      [placeChoice("a", monsterPlace(0, 1))],
      { player: 1 },
    );
    expect(centralPlacementResponse(value)).toBeNull();
  });
});
