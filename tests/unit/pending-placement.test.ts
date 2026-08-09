import { describe, expect, it } from "vitest";
import { choiceId, promptId } from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptPlace,
} from "../../src/duel/contracts/player-prompt.ts";
import type { PhysicalZoneId } from "../../src/field/duel-field-layout.ts";
import {
  resolvePendingPlacementChoice,
  type PendingPlacement,
} from "../../src/app/prompts/pending-placement.ts";

const ARMED_AT = promptId("prompt-idle");
const FOLLOW_UP = promptId("prompt-place");

function placeChoice(id: string, place: PromptPlace): PromptChoice {
  return { id: choiceId(id), label: id, action: "select", place };
}

function placePrompt(
  choices: readonly PromptChoice[],
  overrides: Partial<PlayerPrompt> = {},
): PlayerPrompt {
  return {
    id: FOLLOW_UP,
    kind: "selectPlace",
    player: 0,
    title: "Choose a zone",
    choices,
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  } as PlayerPrompt;
}

function pendingOn(zoneId: PhysicalZoneId): PendingPlacement {
  return Object.freeze({ zoneId, armedAtPromptId: ARMED_AT });
}

describe("resolvePendingPlacementChoice", () => {
  it("pending resolves a matching place prompt", () => {
    const prompt = placePrompt([
      placeChoice("place-1", { player: 0, location: "monster", sequence: 1 }),
    ]);

    expect(
      resolvePendingPlacementChoice(prompt, pendingOn("p0:mainMonster:1")),
    ).toBe(choiceId("place-1"));
  });

  it("resolves the one matching entry out of several offered zones", () => {
    const prompt = placePrompt([
      placeChoice("place-0", { player: 0, location: "monster", sequence: 0 }),
      placeChoice("place-1", { player: 0, location: "monster", sequence: 1 }),
      placeChoice("place-2", { player: 0, location: "monster", sequence: 2 }),
    ]);

    expect(
      resolvePendingPlacementChoice(prompt, pendingOn("p0:mainMonster:2")),
    ).toBe(choiceId("place-2"));
  });

  it("returns null without a pending placement", () => {
    const prompt = placePrompt([
      placeChoice("place-1", { player: 0, location: "monster", sequence: 1 }),
    ]);

    expect(resolvePendingPlacementChoice(prompt, null)).toBeNull();
  });

  it("pending ignores a non-place prompt", () => {
    const prompt = placePrompt(
      [
        {
          id: choiceId("yes"),
          label: "Yes",
          action: "yes",
        },
      ],
      { kind: "yesNo" },
    );

    expect(
      resolvePendingPlacementChoice(prompt, pendingOn("p0:mainMonster:1")),
    ).toBeNull();
  });

  it("pending ignores a multi-count place prompt", () => {
    const choices = [
      placeChoice("place-1", { player: 0, location: "monster", sequence: 1 }),
    ];

    expect(
      resolvePendingPlacementChoice(
        placePrompt(choices, { minimum: 2, maximum: 2 }),
        pendingOn("p0:mainMonster:1"),
      ),
    ).toBeNull();
    expect(
      resolvePendingPlacementChoice(
        placePrompt(choices, { minimum: 1, maximum: 2 }),
        pendingOn("p0:mainMonster:1"),
      ),
    ).toBeNull();
    expect(
      resolvePendingPlacementChoice(
        placePrompt(choices, { minimum: 0, maximum: 1 }),
        pendingOn("p0:mainMonster:1"),
      ),
    ).toBeNull();
  });

  it("pending ignores a zone the engine did not offer", () => {
    const prompt = placePrompt([
      placeChoice("place-0", { player: 0, location: "monster", sequence: 0 }),
    ]);

    expect(
      resolvePendingPlacementChoice(prompt, pendingOn("p0:mainMonster:1")),
    ).toBeNull();
  });

  it("pending ignores an ambiguous match", () => {
    const prompt = placePrompt([
      placeChoice("place-a", { player: 0, location: "monster", sequence: 1 }),
      placeChoice("place-b", { player: 0, location: "monster", sequence: 1 }),
    ]);

    expect(
      resolvePendingPlacementChoice(prompt, pendingOn("p0:mainMonster:1")),
    ).toBeNull();
  });

  it("pending ignores the arming prompt itself", () => {
    const prompt = placePrompt(
      [placeChoice("place-1", { player: 0, location: "monster", sequence: 1 })],
      { id: ARMED_AT },
    );

    expect(
      resolvePendingPlacementChoice(prompt, pendingOn("p0:mainMonster:1")),
    ).toBeNull();
  });

  it("pending ignores an unmappable engine address", () => {
    const prompt = placePrompt([
      placeChoice("place-far", {
        player: 0,
        location: "monster",
        sequence: 99,
      }),
    ]);

    expect(
      resolvePendingPlacementChoice(prompt, pendingOn("p0:mainMonster:1")),
    ).toBeNull();
  });
});
