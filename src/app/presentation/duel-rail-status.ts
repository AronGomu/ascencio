import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type { PublicDuelState } from "../../duel/contracts/public-duel-state.ts";
import { DUEL_PHASE_LABELS } from "./duel-phase-label.ts";

export interface DuelRailStatus {
  readonly title: string;
  readonly subtitle: string;
  readonly thinking: boolean;
}

export function duelRailStatusFor(input: {
  readonly prompt: PlayerPrompt | null;
  readonly snapshot: PublicDuelState | null;
  readonly responsePending: boolean;
}): DuelRailStatus {
  if (input.responsePending)
    return {
      title: "Waiting for the engine",
      subtitle: "Your response is being processed.",
      thinking: true,
    };
  if (input.snapshot === null)
    return {
      title: "Preparing duel",
      subtitle: "Loading current duel state.",
      thinking: true,
    };
  if (input.prompt !== null)
    return {
      title: input.prompt.title,
      subtitle: "Choose in the active prompt.",
      thinking: false,
    };
  if (input.snapshot.turnPlayer === 1)
    return {
      title: "Opponent is thinking",
      subtitle: "Waiting for the opponent's next action.",
      thinking: true,
    };
  return {
    title: "Your move",
    subtitle: `${DUEL_PHASE_LABELS[input.snapshot.phase] ?? "Unknown phase"} · ${input.snapshot.players[0].handCount} cards in hand`,
    thinking: false,
  };
}
