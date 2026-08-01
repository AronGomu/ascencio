import { assertNever } from "../../duel/contracts/assert-never.ts";
import type { DuelPresentationEvent } from "../../duel/contracts/duel-presentation-event.ts";
import { formatDuelPresentationEvent } from "./format-duel-presentation-event.ts";

export type DuelLogSourceType = Exclude<DuelPresentationEvent["type"], "hint">;

export function formatDuelLogEntry(
  event: DuelPresentationEvent,
): { readonly sourceType: DuelLogSourceType; readonly text: string } | null {
  switch (event.type) {
    case "duelStarted":
    case "turnStarted":
    case "phaseChanged":
    case "cardDrawn":
    case "cardsShuffled":
    case "cardMoved":
    case "summon":
    case "specialSummon":
    case "flipSummon":
    case "set":
    case "positionChanged":
    case "attack":
    case "damage":
    case "recover":
    case "lifePointsChanged":
    case "chainChanged":
      return Object.freeze({
        sourceType: event.type,
        text: formatDuelPresentationEvent(event),
      });
    case "hint":
      return null;
    default:
      return assertNever(event, "Unknown duel log event");
  }
}
