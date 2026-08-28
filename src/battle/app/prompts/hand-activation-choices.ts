import type { InteractionChoice } from "./interaction-spec.ts";

/** The subset of a card's choices that activate its effect from the hand. */
export function activateChoices(
  choices: readonly InteractionChoice[],
): readonly InteractionChoice[] {
  return choices.filter((choice) => choice.action === "activate");
}

/**
 * Item 4: the choices a hand card's pointer chip surfaces may show. Activation
 * is answered by the drag-to-zone gesture, so `activate` is hidden from the
 * hover chips and the zoom overlay — but the pinned (keyboard-opened) menu
 * keeps the full list, or a keyboard user could never reach activate on a
 * multi-action hand card. One function feeds both surfaces so they never drift.
 */
export function handChipChoices(
  choices: readonly InteractionChoice[],
  pinned: boolean,
): readonly InteractionChoice[] {
  return pinned
    ? choices
    : choices.filter((choice) => choice.action !== "activate");
}
