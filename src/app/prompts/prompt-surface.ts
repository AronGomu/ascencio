import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type { InteractionSpec } from "./interaction-spec.ts";

export type PromptSurface = "none" | "docked" | "field" | "dialog";

export function promptSurface(
  prompt: PlayerPrompt | null,
  spec: InteractionSpec | null,
  showWorkspace: boolean,
): PromptSurface {
  if (prompt === null) return "none";
  if (showWorkspace) return "docked";
  if (prompt.kind === "chain") return "field";
  if (spec !== null && spec.kind !== "inactive" && spec.fieldCapable)
    return "field";
  return "dialog";
}
