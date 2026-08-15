import type { ChoiceId, PromptId } from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import {
  mapEngineFieldAddress,
  type PhysicalZoneId,
} from "../../field/duel-field-layout.ts";

/**
 * A zone the player dropped a card on, remembered across the round trip
 * between the idle command they chose and the `SELECT_PLACE` prompt the engine
 * only sends afterwards.
 *
 * The intent is a guess, never an authority: `armedAtPromptId` pins it to the
 * prompt it was armed on so a re-issued prompt can never consume it, and every
 * condition below has to hold before it answers anything on the player's
 * behalf. A guess that does not fit the engine's own offer is simply dropped
 * and the real prompt is shown.
 */
export interface PendingPlacement {
  readonly zoneId: PhysicalZoneId;
  readonly armedAtPromptId: PromptId;
}

export function resolvePendingPlacementChoice(
  prompt: PlayerPrompt,
  pending: PendingPlacement | null,
): ChoiceId | null {
  if (pending === null) return null;
  if (prompt.id === pending.armedAtPromptId) return null;
  if (prompt.kind !== "selectPlace") return null;
  if (prompt.minimum !== 1 || prompt.maximum !== 1) return null;

  let match: ChoiceId | null = null;
  for (const choice of prompt.choices) {
    if (choice.place === undefined) continue;
    const mapping = mapEngineFieldAddress(choice.place);
    if (!mapping.ok || mapping.zoneId !== pending.zoneId) continue;
    if (match !== null) return null;
    match = choice.id;
  }
  return match;
}
