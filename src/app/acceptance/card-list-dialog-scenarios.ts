import { cardCode, choiceId } from "../../duel/contracts/ids.ts";
import type { InteractionChoice } from "../prompts/interaction-spec.ts";
import type { BoardStackView } from "../../field/board-view-model.ts";
import type { ZoneListEntry } from "../../field/zone-list.ts";
import type { OffFieldTargetEntry } from "../../field/off-field-target-list.ts";
import type { AcceptanceScenarioId } from "./acceptance-scenario.ts";

export interface CardListAcceptanceScenario {
  readonly id: AcceptanceScenarioId;
  readonly stack: BoardStackView;
  readonly entries: readonly ZoneListEntry[];
  readonly choices: readonly InteractionChoice[];
  readonly mode?: "target";
  readonly targetEntries?: readonly OffFieldTargetEntry[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly cancelable?: boolean;
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
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({
        id: `acceptance:graveyard:${index}`,
        position: index + 1,
        controller: 0 as const,
        location: "graveyard" as const,
        sequence: index,
        identityVisible: true,
        code: cardCode(97590747),
        label: names[index % names.length]!,
      }),
    ),
  );
}

function scenario(
  id: AcceptanceScenarioId,
  count: number,
): CardListAcceptanceScenario {
  const choices: readonly InteractionChoice[] =
    count === 0
      ? []
      : [
          Object.freeze({
            id: choiceId("acceptance-activate"),
            label: "Activate Alpha effect",
            action: "activate",
            cardAddress: Object.freeze({
              controller: 0,
              location: "graveyard",
              sequence: 0,
            }),
          }),
        ];
  return Object.freeze({
    id,
    stack: Object.freeze({ ...stack, count, publicCount: count }),
    entries: entries(count),
    choices,
  });
}

export const CARD_LIST_BROWSE_SIX = scenario("card-list-browse-six", 6);
export const CARD_LIST_BROWSE_OVERFLOW = scenario(
  "card-list-browse-overflow",
  12,
);
export const CARD_LIST_EMPTY = scenario("card-list-empty", 0);

const targetLocations = ["extra", "graveyard", "banished", "deck"] as const;
export const CARD_LIST_TARGET_CHROME: CardListAcceptanceScenario =
  Object.freeze({
    id: "card-list-target-chrome",
    stack,
    entries: Object.freeze([]),
    choices: Object.freeze([]),
    mode: "target",
    minimum: 1,
    maximum: 2,
    cancelable: true,
    targetEntries: Object.freeze(
      targetLocations.map((location, index) => {
        const choice = Object.freeze({
          id: choiceId(`acceptance-target-${location}`),
          label: "Select",
          action: "select" as const,
          cardAddress: Object.freeze({
            controller: 0 as const,
            location,
            sequence: index,
          }),
        });
        const names = {
          extra: "Extra Deck",
          graveyard: "Graveyard",
          banished: "Banished",
          deck: "Deck",
        } as const;
        return Object.freeze({
          id: `acceptance:target:${location}`,
          position: index + 1,
          controller: 0 as const,
          location,
          sequence: index,
          identityVisible: true,
          code: cardCode(97590747),
          label: `${names[location]} target`,
          zoneBadge: names[
            location
          ].toUpperCase() as OffFieldTargetEntry["zoneBadge"],
          zoneLabel: `Your ${names[location]}`,
          choices: Object.freeze([choice]),
        });
      }),
    ),
  });

export function cardListAcceptanceScenario(
  id: AcceptanceScenarioId,
): CardListAcceptanceScenario {
  switch (id) {
    case "card-list-browse-six":
      return CARD_LIST_BROWSE_SIX;
    case "card-list-browse-overflow":
      return CARD_LIST_BROWSE_OVERFLOW;
    case "card-list-empty":
      return CARD_LIST_EMPTY;
    case "card-list-target-chrome":
      return CARD_LIST_TARGET_CHROME;
    default:
      throw new Error(`Not a card-list acceptance scenario: ${id}`);
  }
}
