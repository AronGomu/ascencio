import type { ChoiceAction } from "../../duel/contracts/player-prompt.ts";
import type { BoardZoneView } from "../../field/board-view-model.ts";
import type { PhysicalZoneId } from "../../field/duel-field-layout.ts";
import type { InteractionChoice } from "./interaction-spec.ts";

/**
 * A drop names a zone, never an action, so a zone that can host several of the
 * card's offers leaves the gesture ambiguous. The order below is the order the
 * player is asked in (item 6): play before set, activation before set — the
 * more committal reading of the gesture first — but a second entry is a
 * question now, not a discarded alternative.
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

export function dropChoicesForZone(
  zone: BoardZoneView,
  choices: readonly InteractionChoice[],
): readonly InteractionChoice[] {
  const preference = preferenceForZone(zone);
  if (preference === null) return [];
  return preference.flatMap((action) =>
    choices.filter((choice) => choice.action === action),
  );
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
