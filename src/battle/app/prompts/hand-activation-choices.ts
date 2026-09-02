import type { InteractionChoice } from "./interaction-spec.ts";

/** The subset of a card's choices that activate its effect from the hand. */
export function activateChoices(
  choices: readonly InteractionChoice[],
): readonly InteractionChoice[] {
  return choices.filter((choice) => choice.action === "activate");
}
