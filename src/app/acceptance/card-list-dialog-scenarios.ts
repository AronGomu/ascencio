import { cardCode } from "../../duel/contracts/ids.ts";
import type { BoardStackView } from "../../field/board-view-model.ts";
import type { ZoneListEntry } from "../../field/zone-list.ts";
import type { AcceptanceScenarioId } from "./acceptance-scenario.ts";

export interface CardListAcceptanceScenario {
  readonly id: AcceptanceScenarioId;
  readonly stack: BoardStackView;
  readonly entries: readonly ZoneListEntry[];
}

const stack: BoardStackView = Object.freeze({
  id: "p0:graveyard",
  targetId: "stack:p0:graveyard",
  player: 0,
  zone: "graveyard",
  count: 0,
  publicCount: 0,
  label: "Graveyard",
  accessibleLabel: "Your Graveyard",
  x: 0,
  y: 0,
  width: 0.1,
  height: 0.14,
});

function entries(count: number): readonly ZoneListEntry[] {
  const names = ["Beta", "Alpha", "Gamma", "Alpha", "Delta", "Epsilon"];
  return Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    id: `acceptance:graveyard:${index}`,
    position: index + 1,
    controller: 0 as const,
    location: "graveyard" as const,
    sequence: index,
    identityVisible: true,
    code: cardCode(97590747),
    label: names[index % names.length]!,
  })));
}

function scenario(id: AcceptanceScenarioId, count: number): CardListAcceptanceScenario {
  return Object.freeze({ id, stack: Object.freeze({ ...stack, count, publicCount: count }), entries: entries(count) });
}

export const CARD_LIST_BROWSE_SIX = scenario("card-list-browse-six", 6);
export const CARD_LIST_BROWSE_OVERFLOW = scenario("card-list-browse-overflow", 12);
export const CARD_LIST_EMPTY = scenario("card-list-empty", 0);

export function cardListAcceptanceScenario(id: AcceptanceScenarioId): CardListAcceptanceScenario {
  switch (id) {
    case "card-list-browse-six": return CARD_LIST_BROWSE_SIX;
    case "card-list-browse-overflow": return CARD_LIST_BROWSE_OVERFLOW;
    case "card-list-empty": return CARD_LIST_EMPTY;
    default: throw new Error(`Not a card-list acceptance scenario: ${id}`);
  }
}
