import { describe, expect, it } from "vitest";
import {
  CARD_ACTION_LABELS,
  cardActionLabel,
} from "../../src/battle/app/presentation/card-action-label.ts";
import type { ChoiceAction } from "../../src/battle/duel/contracts/player-prompt.ts";

// Mirrors the `ChoiceAction` union. `satisfies` keeps the two in lockstep: a
// new union member that is missing here fails the exhaustiveness check below,
// and a stale member here fails to type as `ChoiceAction`.
const CHOICE_ACTIONS = [
  "summon",
  "specialSummon",
  "flipSummon",
  "setMonster",
  "setSpellTrap",
  "activate",
  "changePosition",
  "attack",
  "battlePhase",
  "mainPhase2",
  "endPhase",
  "shuffle",
  "yes",
  "no",
  "pass",
  "cancel",
  "finish",
  "select",
] as const satisfies readonly ChoiceAction[];

type CoveredAction = (typeof CHOICE_ACTIONS)[number];
type UncoveredAction = Exclude<ChoiceAction, CoveredAction>;
const _exhaustive: UncoveredAction extends never ? true : never = true;

describe("card action labels", () => {
  it("every choice action has a label", () => {
    expect(_exhaustive).toBe(true);
    expect(new Set(Object.keys(CARD_ACTION_LABELS))).toEqual(
      new Set(CHOICE_ACTIONS),
    );
    expect(CHOICE_ACTIONS).toHaveLength(18);
    expect(Object.keys(CARD_ACTION_LABELS)).toHaveLength(18);
  });

  it("labels stay short", () => {
    for (const [action, label] of Object.entries(CARD_ACTION_LABELS)) {
      expect(label.trim(), action).toBe(label);
      expect(label.length, action).toBeGreaterThan(0);
      expect(
        label.split(/\s+/).length,
        `${action} => ${label}`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("set actions collapse to one word", () => {
    expect(cardActionLabel("setMonster")).toBe("Set");
    expect(cardActionLabel("setSpellTrap")).toBe("Set");
  });

  it("activate collapses to one word", () => {
    expect(cardActionLabel("activate")).toBe("Activate");
  });
});
