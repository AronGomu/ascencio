import type { ChoiceAction } from "../../duel/contracts/player-prompt.ts";

/**
 * Short chip wording for every engine choice action. Chips are tiny fixed-size
 * overlays, so the label is the action word, never the engine's full choice
 * text (`Activate Mystical Space Typhoon`), which stays on the chip's `title`
 * and accessible name. `setMonster` and `setSpellTrap` deliberately collapse to
 * the same word: the card the chip sits on already says which one it is.
 */
export const CARD_ACTION_LABELS: Readonly<Record<ChoiceAction, string>> =
  Object.freeze({
    summon: "Summon",
    specialSummon: "Special Summon",
    flipSummon: "Flip",
    setMonster: "Set",
    setSpellTrap: "Set",
    activate: "Activate",
    changePosition: "Change Position",
    attack: "Attack",
    battlePhase: "Battle",
    mainPhase2: "Main 2",
    endPhase: "End turn",
    shuffle: "Shuffle",
    yes: "Yes",
    no: "No",
    pass: "Pass",
    cancel: "Cancel",
    finish: "Finish",
    select: "Select",
  });

export function cardActionLabel(action: ChoiceAction): string {
  return CARD_ACTION_LABELS[action];
}
