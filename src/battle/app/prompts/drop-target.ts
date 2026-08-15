import type { ChoiceAction } from "../../duel/contracts/player-prompt.ts";
import type { BoardZoneView } from "../../field/board-view-model.ts";
import type { PhysicalZoneId } from "../../field/duel-field-layout.ts";
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
/**
 * The two shared Extra Monster Zones carry `kind: "monster"` like the main
 * monster row, so the kind alone cannot tell them apart — only the id can.
 * Nothing but a Special Summon ever reaches them: falling back to `summon`
 * would irreversibly burn the once-per-turn Normal Summon, and the engine's
 * follow-up place prompt only offers monster sequences 0-4 for it, stranding
 * the player in a manual placement. Refusing the drop costs nothing.
 */
const EXTRA_MONSTER_PREFERENCE: readonly ChoiceAction[] = Object.freeze([
  "specialSummon",
]);
const EXTRA_MONSTER_ZONE_IDS: ReadonlySet<PhysicalZoneId> =
  new Set<PhysicalZoneId>([
    "shared:extraMonster:left",
    "shared:extraMonster:right",
  ]);

export function dropChoiceForZone(
  zone: BoardZoneView,
  choices: readonly InteractionChoice[],
): InteractionChoice | null {
  const preference = preferenceForZone(zone);
  if (preference === null) return null;
  for (const action of preference) {
    const match = choices.find((choice) => choice.action === action);
    if (match !== undefined) return match;
  }
  return null;
}

function preferenceForZone(
  zone: BoardZoneView,
): readonly ChoiceAction[] | null {
  if (zone.kind === "spellTrap") return SPELL_TRAP_PREFERENCE;
  if (zone.kind !== "monster") return null;
  return EXTRA_MONSTER_ZONE_IDS.has(zone.id)
    ? EXTRA_MONSTER_PREFERENCE
    : MONSTER_PREFERENCE;
}
