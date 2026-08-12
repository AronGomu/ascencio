import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type { InteractionSpec } from "./interaction-spec.ts";

export type PromptSurface = "none" | "docked" | "field" | "dialog";

export function promptSurface(
  prompt: PlayerPrompt | null,
  spec: InteractionSpec | null,
  showWorkspace: boolean,
  fieldRendered = true,
): PromptSurface {
  if (prompt === null) return "none";
  if (showWorkspace) return "docked";
  if (prompt.kind === "chain") return fieldRendered ? "field" : "dialog";
  if (prompt.kind === "battleCommand")
    return fieldRendered ? "field" : "dialog";
  /* R1/F1: field capability is not the same as a mounted field. A board
     mapping failure leaves no `DuelField` to answer on, and an off-field
     target counts towards `fieldCapable` even then, so the surface has to
     consult what is actually rendered or the prompt becomes unanswerable. */
  if (spec !== null && spec.kind !== "inactive" && spec.fieldCapable)
    return fieldRendered ? "field" : "dialog";
  return "dialog";
}
