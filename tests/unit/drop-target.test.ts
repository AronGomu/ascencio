import { describe, expect, it } from "vitest";
import { choiceId } from "../../src/duel/contracts/ids.ts";
import type { ChoiceAction } from "../../src/duel/contracts/player-prompt.ts";
import type { BoardZoneView } from "../../src/field/board-view-model.ts";
import type { FieldZoneKind } from "../../src/field/duel-field-layout.ts";
import { dropChoiceForZone } from "../../src/app/prompts/drop-target.ts";
import type { InteractionChoice } from "../../src/app/prompts/interaction-spec.ts";

function choice(action: ChoiceAction): InteractionChoice {
  return Object.freeze({
    id: choiceId(`prompt-choice-0-${action}`),
    label: `Do ${action}`,
    action,
  });
}

function zone(kind: FieldZoneKind): BoardZoneView {
  return Object.freeze({
    id: "p0:mainMonster:0",
    targetId: "zone:p0:mainMonster:0",
    player: 0,
    kind,
    sequence: 0,
    label: `Your ${kind} 1`,
    x: 0.5,
    y: 0.5,
    width: 0.1,
    height: 0.1,
  });
}

describe("dropChoiceForZone", () => {
  it("monster zone prefers summon", () => {
    expect(
      dropChoiceForZone(zone("monster"), [
        choice("setMonster"),
        choice("summon"),
      ]),
    ).toEqual(choice("summon"));
  });

  it("monster zone falls back to set", () => {
    expect(dropChoiceForZone(zone("monster"), [choice("setMonster")])).toEqual(
      choice("setMonster"),
    );
  });

  it("monster zone takes a special summon over a set", () => {
    expect(
      dropChoiceForZone(zone("monster"), [
        choice("setMonster"),
        choice("specialSummon"),
      ]),
    ).toEqual(choice("specialSummon"));
  });

  it("spell zone prefers activate", () => {
    expect(
      dropChoiceForZone(zone("spellTrap"), [
        choice("setSpellTrap"),
        choice("activate"),
      ]),
    ).toEqual(choice("activate"));
  });

  it("spell zone falls back to set", () => {
    expect(
      dropChoiceForZone(zone("spellTrap"), [choice("setSpellTrap")]),
    ).toEqual(choice("setSpellTrap"));
  });

  it("graveyard zone is not a drop target", () => {
    expect(
      dropChoiceForZone(zone("graveyard"), [
        choice("summon"),
        choice("activate"),
      ]),
    ).toBeNull();
  });

  it("field zone is not a drop target", () => {
    expect(dropChoiceForZone(zone("field"), [choice("activate")])).toBeNull();
  });

  it("returns null when no choice fits the zone kind", () => {
    expect(dropChoiceForZone(zone("monster"), [choice("activate")])).toBeNull();
    expect(dropChoiceForZone(zone("spellTrap"), [choice("summon")])).toBeNull();
    expect(dropChoiceForZone(zone("monster"), [])).toBeNull();
  });
});
