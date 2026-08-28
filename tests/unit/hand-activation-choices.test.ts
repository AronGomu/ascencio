import { describe, expect, it } from "vitest";
import {
  activateChoices,
  handChipChoices,
} from "../../src/battle/app/prompts/hand-activation-choices.ts";
import type { InteractionChoice } from "../../src/battle/app/prompts/interaction-spec.ts";
import { choiceId } from "../../src/battle/duel/contracts/ids.ts";

const ACTIVATE: InteractionChoice = Object.freeze({
  id: choiceId("activate"),
  label: "Activate",
  action: "activate",
});
const SET_SPELL_TRAP: InteractionChoice = Object.freeze({
  id: choiceId("setspelltrap"),
  label: "Set",
  action: "setSpellTrap",
});
const SUMMON: InteractionChoice = Object.freeze({
  id: choiceId("summon"),
  label: "Summon",
  action: "summon",
});

/* Activation deliberately sits first, the way `dropChoicesForZone` orders a
   backrow drop, so every assertion also proves the surviving order. */
const CHOICES: readonly InteractionChoice[] = Object.freeze([
  ACTIVATE,
  SET_SPELL_TRAP,
  SUMMON,
]);

describe("activateChoices", () => {
  it("keeps only activate actions", () => {
    expect(activateChoices(CHOICES)).toEqual([ACTIVATE]);
    expect(activateChoices([SET_SPELL_TRAP, SUMMON])).toEqual([]);
    expect(activateChoices([])).toEqual([]);
  });
});

describe("handChipChoices", () => {
  it("hides activate while unpinned", () => {
    expect(handChipChoices(CHOICES, false)).toEqual([SET_SPELL_TRAP, SUMMON]);
  });

  it("keeps the full list for the pinned menu", () => {
    expect(handChipChoices(CHOICES, true)).toEqual([
      ACTIVATE,
      SET_SPELL_TRAP,
      SUMMON,
    ]);
  });
});
