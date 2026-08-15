import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";

export function hasDuelPriority(
  prompt: PlayerPrompt | null,
  responsePending: boolean,
): boolean {
  return prompt !== null && !responsePending;
}
