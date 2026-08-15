import type { ChoiceAction } from "../duel/contracts/player-prompt.ts";
import type { BoardViewModel } from "./board-view-model.ts";
import type { PhysicalZoneId } from "./duel-field-layout.ts";

/**
 * Non-authoritative placement guesses for player 0. `ocgcore` does not reveal
 * legal zones while it is asking for an idle command, so the field can only
 * offer the physically plausible ones and let the follow-up `SELECT_PLACE`
 * prompt stay the single source of truth (assumption A5).
 *
 * The field spell zone is deliberately never returned (assumption A7).
 */
const MAIN_MONSTER_ZONES: readonly PhysicalZoneId[] = Object.freeze([
  "p0:mainMonster:0",
  "p0:mainMonster:1",
  "p0:mainMonster:2",
  "p0:mainMonster:3",
  "p0:mainMonster:4",
]);
const EXTRA_MONSTER_ZONES: readonly PhysicalZoneId[] = Object.freeze([
  "shared:extraMonster:left",
  "shared:extraMonster:right",
]);
const SPELL_TRAP_ZONES: readonly PhysicalZoneId[] = Object.freeze([
  "p0:spellTrap:0",
  "p0:spellTrap:1",
  "p0:spellTrap:2",
  "p0:spellTrap:3",
  "p0:spellTrap:4",
]);
const NO_CANDIDATES: readonly PhysicalZoneId[] = Object.freeze([]);

export function placementZoneCandidates(
  action: ChoiceAction,
  board: BoardViewModel,
): readonly PhysicalZoneId[] {
  const zones = zonesForAction(action);
  if (zones.length === 0) return NO_CANDIDATES;
  const occupied = new Set<PhysicalZoneId>(
    board.cards.map((card) => card.zoneId),
  );
  return Object.freeze(zones.filter((zoneId) => !occupied.has(zoneId)));
}

function zonesForAction(action: ChoiceAction): readonly PhysicalZoneId[] {
  switch (action) {
    case "summon":
    case "setMonster":
      return MAIN_MONSTER_ZONES;
    case "specialSummon":
      return [...MAIN_MONSTER_ZONES, ...EXTRA_MONSTER_ZONES];
    case "activate":
    case "setSpellTrap":
      return SPELL_TRAP_ZONES;
    default:
      return NO_CANDIDATES;
  }
}
