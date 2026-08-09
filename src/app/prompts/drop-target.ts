import type { ChoiceAction } from "../../duel/contracts/player-prompt.ts";
import type { BoardZoneView } from "../../field/board-view-model.ts";
import type { InteractionChoice } from "./interaction-spec.ts";

/**
 * One drop is one action, so a zone that could host several of the card's
 * offers has to pick a single primary (assumption A6). Play beats set, and an
 * activation beats a set: the more committal reading of the gesture is the one
 * a player who dragged a card onto an empty zone meant.
 */
const MONSTER_PREFERENCE: readonly ChoiceAction[] = Object.freeze([
  "summon",
  "specialSummon",
  "setMonster",
]);
const SPELL_TRAP_PREFERENCE: readonly ChoiceAction[] = Object.freeze([
  "activate",
  "setSpellTrap",
]);

export function dropChoiceForZone(
  zone: BoardZoneView,
  choices: readonly InteractionChoice[],
): InteractionChoice | null {
  const preference =
    zone.kind === "monster"
      ? MONSTER_PREFERENCE
      : zone.kind === "spellTrap"
        ? SPELL_TRAP_PREFERENCE
        : null;
  if (preference === null) return null;
  for (const action of preference) {
    const match = choices.find((choice) => choice.action === action);
    if (match !== undefined) return match;
  }
  return null;
}
