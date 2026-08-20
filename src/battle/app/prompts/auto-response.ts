import type { DuelPresentationEvent } from "../../duel/contracts/duel-presentation-event.ts";
import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type {
  PlayerIndex,
  PublicDuelState,
} from "../../duel/contracts/public-duel-state.ts";

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

/**
 * Who the duel's latest action belongs to. The core's chain windows name no
 * actor, so the newest action event answers it, and a fresh turn resets the
 * answer to the turn player rather than carrying the previous turn's actor
 * across the boundary.
 */
export function lastActionActor(
  events: readonly DuelPresentationEvent[],
  turnPlayer: PlayerIndex,
): PlayerIndex {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event === undefined || event.type === "turnStarted") break;
    /* `positionChanged` is absent on purpose: it carries a card code and a
       position, and no player or controller an actor could be read from —
       attributing it would be a guess. */
    switch (event.type) {
      case "summon":
      case "specialSummon":
      case "flipSummon":
      case "set":
      case "attack":
        return event.player;
      default:
        break;
    }
  }
  return turnPlayer;
}

/**
 * The pass choice answering a chain window the player opened themselves, or
 * `null` when the window belongs to something the opponent did. Responding to
 * your own effect is the window nobody wants to click through; anything the
 * opponent caused stays a decision. Full Control turns this off entirely —
 * this function is simply not consulted then.
 */
export function ownEffectChainPassResponse(
  prompt: PlayerPrompt,
  snapshot: PublicDuelState | null,
  actor: PlayerIndex,
): readonly ChoiceId[] | null {
  if (prompt.kind !== "chain" || prompt.player !== 0) return null;
  const passChoice = prompt.choices.find((c) => c.action === "pass");
  if (passChoice === undefined) return null;

  /* The chain itself is the stronger attribution: its last link names its own
     controller, so the actor heuristic only answers an empty chain. */
  const lastLink = snapshot === null ? undefined : snapshot.chain.at(-1);
  const owner = lastLink === undefined ? actor : lastLink.controller;
  return owner === 0 ? [passChoice.id] : null;
}
