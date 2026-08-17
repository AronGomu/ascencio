import { cardCode, choiceId, type ChoiceId } from "../../duel/contracts/ids.ts";
import type { InteractionChoice } from "../prompts/interaction-spec.ts";
import type { BoardStackView } from "../../field/board-view-model.ts";
import type { ZoneListEntry } from "../../field/zone-list.ts";
import type {
  OffFieldTargetEntry,
  OffFieldZoneBadge,
} from "../../field/off-field-target-list.ts";
import type { AcceptanceScenarioId } from "./acceptance-scenario.ts";

export interface CardListAcceptanceScenario {
  readonly id: AcceptanceScenarioId;
  readonly stack: BoardStackView;
  readonly entries: readonly ZoneListEntry[];
  readonly choices: readonly InteractionChoice[];
  readonly mode?: "target";
  readonly targetEntries?: readonly OffFieldTargetEntry[];
  readonly initialSelectedChoiceIds?: readonly ChoiceId[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly confirmValid?: boolean;
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

function browseChoice(
  id: string,
  label: string,
  sequence: number,
): InteractionChoice {
  return Object.freeze({
    id: choiceId(id),
    label,
    action: "activate",
    cardAddress: Object.freeze({
      controller: 0,
      location: "graveyard",
      sequence,
    }),
  });
}

function browseScenario(
  id: AcceptanceScenarioId,
  count: number,
): CardListAcceptanceScenario {
  const choices =
    count === 0
      ? []
      : [
          browseChoice(
            "acceptance-activate-first",
            count === 6 ? "Activate Alpha effect" : "Activate first card",
            0,
          ),
          ...(count > 1
            ? [
                browseChoice(
                  "acceptance-activate-last",
                  "Activate last card",
                  count - 1,
                ),
              ]
            : []),
        ];
  return Object.freeze({
    id,
    stack: Object.freeze({ ...stack, count, publicCount: count }),
    entries: entries(count),
    choices: Object.freeze(choices),
  });
}

export const CARD_LIST_BROWSE_SIX = browseScenario("card-list-browse-six", 6);

const opponentStack: BoardStackView = Object.freeze({
  id: "p1:graveyard",
  targetId: "stack:p1:graveyard",
  player: 1,
  zone: "graveyard",
  count: 2,
  publicCount: 2,
  label: "Opponent Graveyard",
  accessibleLabel: "Opponent Graveyard",
  x: 0,
  y: 0,
  width: 0.1,
  height: 0.14,
});

const opponentEntries: readonly ZoneListEntry[] = Object.freeze(
  Array.from({ length: 2 }, (_, index) =>
    Object.freeze({
      id: `acceptance:opp-graveyard:${index}`,
      position: index + 1,
      controller: 1 as const,
      location: "graveyard" as const,
      sequence: index,
      identityVisible: true,
      code: cardCode(97590747),
      label: `Opponent Card ${index + 1}`,
    }),
  ),
);

export const CARD_LIST_BROWSE_OPPONENT: CardListAcceptanceScenario =
  Object.freeze({
    id: "card-list-browse-opponent",
    stack: opponentStack,
    entries: opponentEntries,
    choices: Object.freeze([]),
  });
export const CARD_LIST_BROWSE_OVERFLOW = browseScenario(
  "card-list-browse-overflow",
  12,
);
export const CARD_LIST_EMPTY = browseScenario("card-list-empty", 0);

type TargetLocation = "hand" | "extra" | "graveyard" | "banished" | "deck";

const ZONE_DETAILS = Object.freeze({
  hand: Object.freeze({ badge: "HAND", name: "Hand" }),
  extra: Object.freeze({ badge: "EXTRA DECK", name: "Extra Deck" }),
  graveyard: Object.freeze({ badge: "GRAVEYARD", name: "Graveyard" }),
  banished: Object.freeze({ badge: "BANISHED", name: "Banished" }),
  deck: Object.freeze({ badge: "DECK", name: "Deck" }),
} satisfies Readonly<
  Record<
    TargetLocation,
    { readonly badge: OffFieldZoneBadge; readonly name: string }
  >
>);

function targetChoice(
  id: string,
  location: TargetLocation,
  sequence: number,
  label = "Select",
): InteractionChoice {
  return Object.freeze({
    id: choiceId(id),
    label,
    action: "select",
    cardAddress: Object.freeze({
      controller: 0,
      location,
      sequence,
    }),
  });
}

function targetEntry(
  fixture: string,
  index: number,
  location: TargetLocation,
  choices: readonly InteractionChoice[] = [
    targetChoice(`acceptance-${fixture}-${index}`, location, index),
  ],
): OffFieldTargetEntry {
  const details = ZONE_DETAILS[location];
  return Object.freeze({
    id: `acceptance:${fixture}:${index}`,
    position: index + 1,
    controller: 0,
    location,
    sequence: index,
    identityVisible: true,
    code: cardCode(97590747),
    label: `${details.name} target ${index + 1}`,
    zoneBadge: details.badge,
    zoneLabel: `Your ${details.name}`,
    choices: Object.freeze([...choices]),
  });
}

function targetScenario(input: {
  readonly id: AcceptanceScenarioId;
  readonly entries: readonly OffFieldTargetEntry[];
  readonly minimum: number;
  readonly maximum: number;
  readonly cancelable?: boolean;
  readonly initialSelectedChoiceIds?: readonly ChoiceId[];
}): CardListAcceptanceScenario {
  return Object.freeze({
    id: input.id,
    stack,
    entries: Object.freeze([]),
    choices: Object.freeze([]),
    mode: "target",
    targetEntries: Object.freeze([...input.entries]),
    initialSelectedChoiceIds: Object.freeze([
      ...(input.initialSelectedChoiceIds ?? []),
    ]),
    minimum: input.minimum,
    maximum: input.maximum,
    confirmValid: true,
    cancelable: input.cancelable ?? false,
  });
}

export const CARD_LIST_SINGLE_TARGET = targetScenario({
  id: "card-list-single",
  entries: [
    targetEntry("single", 0, "graveyard"),
    targetEntry("single", 1, "graveyard"),
  ],
  minimum: 1,
  maximum: 1,
});

export const CARD_LIST_MULTIPLE_TARGETS = targetScenario({
  id: "card-list-multiple",
  entries: Array.from({ length: 4 }, (_, index) =>
    targetEntry("multiple", index, "graveyard"),
  ),
  minimum: 3,
  maximum: 3,
  cancelable: true,
});

export const CARD_LIST_MIXED_TARGETS = targetScenario({
  id: "card-list-mixed",
  entries: (["extra", "graveyard", "banished", "deck"] as const).map(
    (location, index) => targetEntry("mixed", index, location),
  ),
  minimum: 2,
  maximum: 2,
  cancelable: true,
});

export const CARD_LIST_RANGE_TARGETS = targetScenario({
  id: "card-list-range",
  entries: Array.from({ length: 4 }, (_, index) =>
    targetEntry("range", index, "graveyard"),
  ),
  minimum: 1,
  maximum: 3,
});

export const CARD_LIST_HAND_MIXED_TARGETS = targetScenario({
  id: "card-list-hand-mixed",
  entries: (["hand", "graveyard", "deck"] as const).map((location, index) =>
    targetEntry("hand-mixed", index, location),
  ),
  minimum: 1,
  maximum: 2,
});

const duplicateChoices = Object.freeze([
  targetChoice("acceptance-duplicate-first", "graveyard", 0, "Banish"),
  targetChoice("acceptance-duplicate-second", "graveyard", 0, "Shuffle back"),
]);

export const CARD_LIST_DUPLICATE_CHOICES = targetScenario({
  id: "card-list-duplicate",
  entries: [targetEntry("duplicate", 0, "graveyard", duplicateChoices)],
  minimum: 2,
  maximum: 2,
});

const staleRenderedId = choiceId("acceptance-stale-rendered");
export const CARD_LIST_STALE_SELECTION = targetScenario({
  id: "card-list-stale",
  entries: [
    targetEntry("stale", 0, "graveyard", [
      targetChoice("acceptance-stale-rendered", "graveyard", 0),
    ]),
  ],
  minimum: 1,
  maximum: 1,
  initialSelectedChoiceIds: [
    staleRenderedId,
    choiceId("acceptance-stale-missing"),
  ],
});

export const CARD_LIST_TARGET_CHROME = targetScenario({
  id: "card-list-target-chrome",
  entries: (["extra", "graveyard", "banished", "deck"] as const).map(
    (location, index) => targetEntry("target", index, location),
  ),
  minimum: 1,
  maximum: 2,
  cancelable: true,
});

export function cardListAcceptanceScenario(
  id: AcceptanceScenarioId,
): CardListAcceptanceScenario {
  switch (id) {
    case "card-list-browse-six":
      return CARD_LIST_BROWSE_SIX;
    case "card-list-browse-overflow":
      return CARD_LIST_BROWSE_OVERFLOW;
    case "card-list-browse-opponent":
      return CARD_LIST_BROWSE_OPPONENT;
    case "card-list-empty":
      return CARD_LIST_EMPTY;
    case "card-list-target-chrome":
      return CARD_LIST_TARGET_CHROME;
    case "card-list-single":
      return CARD_LIST_SINGLE_TARGET;
    case "card-list-multiple":
      return CARD_LIST_MULTIPLE_TARGETS;
    case "card-list-mixed":
      return CARD_LIST_MIXED_TARGETS;
    case "card-list-range":
      return CARD_LIST_RANGE_TARGETS;
    case "card-list-hand-mixed":
      return CARD_LIST_HAND_MIXED_TARGETS;
    case "card-list-duplicate":
      return CARD_LIST_DUPLICATE_CHOICES;
    case "card-list-stale":
      return CARD_LIST_STALE_SELECTION;
    default:
      throw new Error(`Not a card-list acceptance scenario: ${id}`);
  }
}
