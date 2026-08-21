import { describe, expect, it } from "vitest";
import { choiceId } from "../../src/battle/duel/contracts/ids.ts";
import type { ChoiceAction } from "../../src/battle/duel/contracts/player-prompt.ts";
import type { BoardZoneView } from "../../src/battle/field/board-view-model.ts";
import type {
  FieldZoneKind,
  PhysicalZoneId,
} from "../../src/battle/field/duel-field-layout.ts";
import { dropChoicesForZone } from "../../src/battle/app/prompts/drop-target.ts";
import type { InteractionChoice } from "../../src/battle/app/prompts/interaction-spec.ts";

function choice(action: ChoiceAction): InteractionChoice {
  return Object.freeze({
    id: choiceId(`prompt-choice-0-${action}`),
    label: `Do ${action}`,
    action,
  });
}

/* The id matters as much as the kind: the two shared Extra Monster Zones also
   carry `kind: "monster"`, so a helper that only varied the kind could never
   tell them apart from the main monster row. */
function zone(
  kind: FieldZoneKind,
  id: PhysicalZoneId = "p0:mainMonster:0",
): BoardZoneView {
  return Object.freeze({
    id,
    targetId: `zone:${id}` as const,
    player: id.startsWith("shared:") ? ("shared" as const) : (0 as const),
    kind,
    sequence: 0,
    label: `${kind} 1`,
    accessibleLabel: `Your ${kind} 1`,
    x: 0.5,
    y: 0.5,
    width: 0.1,
    height: 0.1,
  });
}

function extraMonsterZone(side: "left" | "right"): BoardZoneView {
  return zone("monster", `shared:extraMonster:${side}`);
}

/* The order is the modal's button order, so every assertion reads the actions
   as a list rather than picking one out of it. */
function actionsFor(
  target: BoardZoneView,
  choices: readonly InteractionChoice[],
): readonly ChoiceAction[] {
  return dropChoicesForZone(target, choices).map(({ action }) => action);
}

describe("dropChoicesForZone", () => {
  it("returns every legal action for the zone in preference order", () => {
    expect(
      actionsFor(zone("spellTrap"), [
        choice("setSpellTrap"),
        choice("activate"),
      ]),
    ).toEqual(["activate", "setSpellTrap"]);
    expect(
      actionsFor(zone("monster"), [
        choice("setMonster"),
        choice("summon"),
        choice("specialSummon"),
      ]),
    ).toEqual(["summon", "specialSummon", "setMonster"]);
  });

  it("returns the choices themselves, not their actions", () => {
    expect(
      dropChoicesForZone(zone("monster"), [
        choice("setMonster"),
        choice("summon"),
      ]),
    ).toEqual([choice("summon"), choice("setMonster")]);
  });

  it("returns a single action unchanged", () => {
    expect(actionsFor(zone("monster"), [choice("summon")])).toEqual(["summon"]);
    expect(actionsFor(zone("monster"), [choice("setMonster")])).toEqual([
      "setMonster",
    ]);
    expect(actionsFor(zone("spellTrap"), [choice("setSpellTrap")])).toEqual([
      "setSpellTrap",
    ]);
  });

  it.each(["left", "right"] as const)(
    "extra monster zone %s still offers only specialSummon",
    (side) => {
      expect(
        actionsFor(extraMonsterZone(side), [
          choice("summon"),
          choice("specialSummon"),
          choice("setMonster"),
        ]),
      ).toEqual(["specialSummon"]);
    },
  );

  it.each(["left", "right"] as const)(
    "extra monster zone %s refuses a normal summon or a set",
    (side) => {
      expect(
        actionsFor(extraMonsterZone(side), [
          choice("summon"),
          choice("setMonster"),
        ]),
      ).toEqual([]);
    },
  );

  it("returns an empty list for a zone that hosts none", () => {
    expect(
      actionsFor(zone("deck", "p0:deck"), [
        choice("summon"),
        choice("activate"),
      ]),
    ).toEqual([]);
    expect(
      actionsFor(zone("graveyard", "p0:graveyard"), [
        choice("summon"),
        choice("activate"),
      ]),
    ).toEqual([]);
    expect(actionsFor(zone("field", "p0:field"), [choice("activate")])).toEqual(
      [],
    );
  });

  it("returns an empty list when no choice fits the zone kind", () => {
    expect(actionsFor(zone("monster"), [choice("activate")])).toEqual([]);
    expect(actionsFor(zone("spellTrap"), [choice("summon")])).toEqual([]);
    expect(actionsFor(zone("monster"), [])).toEqual([]);
  });
});
