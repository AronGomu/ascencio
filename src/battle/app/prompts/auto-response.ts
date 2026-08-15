import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";

/**
 * The choice ids that answer a prompt carrying no real decision, or `null`
 * when the player must decide. Never returns an empty array: a prompt that
 * needs an empty response is a decision, not a formality.
 */
export function trivialPromptResponse(
  prompt: PlayerPrompt,
): readonly ChoiceId[] | null {
  if (prompt.player !== 0) return null;
  if (!(prompt.minimum <= 1 && prompt.maximum >= 1)) return null;

  if (prompt.kind === "chain") {
    const activatable = prompt.choices.filter((c) => c.action !== "pass");
    if (activatable.length === 0) {
      const passChoice = prompt.choices.find((c) => c.action === "pass");
      return passChoice === undefined ? null : [passChoice.id];
    }
    if (activatable.length === 1 && prompt.choices.length === 1) {
      const only = activatable[0];
      return only === undefined ? null : [only.id];
    }
    return null;
  }

  if (prompt.kind === "option" && prompt.choices.length === 1) {
    const only = prompt.choices[0];
    return only === undefined ? null : [only.id];
  }

  if (prompt.kind === "selectPosition" && prompt.choices.length === 1) {
    const only = prompt.choices[0];
    return only === undefined ? null : [only.id];
  }

  return null;
}
