import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptPlace,
} from "../../duel/contracts/player-prompt.ts";

const MAIN_CENTRALITY: readonly number[] = Object.freeze([2, 1, 3, 0, 4]);

/** Lower is more central. Deterministic and total over every `PromptPlace`. */
export function placementRank(place: PromptPlace): number {
  const playerTerm = place.player === 0 ? 0 : 1_000;
  if (place.location === "monster" && place.sequence > 4)
    return playerTerm + 100 + (place.sequence - 5);
  const index = MAIN_CENTRALITY.indexOf(place.sequence);
  return playerTerm + (index < 0 ? 50 + place.sequence : index);
}

/**
 * The single most central place offered by a `selectPlace` prompt, or `null`
 * when the prompt is not a plain one-of-many placement decision.
 */
export function centralPlacementResponse(
  prompt: PlayerPrompt,
): readonly ChoiceId[] | null {
  if (
    prompt.player !== 0 ||
    prompt.kind !== "selectPlace" ||
    prompt.minimum !== 1 ||
    prompt.maximum !== 1
  )
    return null;

  const placed = prompt.choices
    .filter((choice) => choice.place !== undefined)
    .map((choice) => ({ id: choice.id, place: choice.place as PromptPlace }));
  if (placed.length === 0) return null;

  placed.sort((a, b) => {
    const rankDelta = placementRank(a.place) - placementRank(b.place);
    return rankDelta !== 0 ? rankDelta : a.id.localeCompare(b.id);
  });

  const first = placed[0];
  return first === undefined ? null : [first.id];
}
