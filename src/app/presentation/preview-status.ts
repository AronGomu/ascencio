import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";

export interface CardPreviewStatus {
  readonly text: string;
  /** Renders the animated three-dot "thinking" indicator after `text`. */
  readonly thinking: boolean;
}

export function previewStatusFor(
  prompt: PlayerPrompt | null,
  responsePending: boolean,
): CardPreviewStatus | null {
  if (responsePending)
    return { text: "Waiting for the engine", thinking: true };
  if (prompt === null) return { text: "Opponent is acting", thinking: true };
  if (prompt.kind === "chain")
    return { text: "Do you respond?", thinking: true };
  return { text: prompt.title, thinking: false };
}
