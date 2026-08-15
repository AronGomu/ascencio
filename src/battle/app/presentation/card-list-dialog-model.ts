import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type { BoardStackView } from "../../field/board-view-model.ts";
import type { OffFieldTargetEntry } from "../../field/off-field-target-list.ts";
import { ImmutableChoiceIdSet } from "./immutable-choice-id-set.ts";

export interface CardListSelectionState {
  readonly selectedCount: number;
  readonly maximumReached: boolean;
  readonly renderedSelectionValid: boolean;
  readonly validateEnabled: boolean;
  readonly countLabel: string;
  readonly unavailableChoiceIds: ReadonlySet<ChoiceId>;
}

export function cardListSelectionState(input: {
  readonly selectedChoiceIds: readonly ChoiceId[];
  readonly entries: readonly Pick<OffFieldTargetEntry, "choices">[];
  readonly minimum: number;
  readonly maximum: number;
  readonly promptValid: boolean;
}): CardListSelectionState {
  const { entries, selectedChoiceIds, minimum, maximum, promptValid } = input;
  const renderedIds = new Set(
    entries.flatMap((entry) => entry.choices.map((choice) => choice.id)),
  );
  const uniqueSelected = new Set(selectedChoiceIds);
  const selectedCount = selectedChoiceIds.length;
  const renderedSelectionValid =
    uniqueSelected.size === selectedCount &&
    selectedChoiceIds.every((id) => renderedIds.has(id));
  const validBounds =
    Number.isInteger(minimum) &&
    Number.isInteger(maximum) &&
    minimum >= 0 &&
    maximum >= minimum;
  const maximumReached = validBounds && selectedCount >= maximum;
  const unavailableChoiceIds = new ImmutableChoiceIdSet(
    maximumReached
      ? [...renderedIds].filter((id) => !uniqueSelected.has(id))
      : [],
  );
  const validateEnabled =
    validBounds &&
    promptValid &&
    renderedSelectionValid &&
    selectedCount >= minimum &&
    selectedCount <= maximum;
  const countLabel = !validBounds
    ? `${selectedCount} selected · invalid requirement`
    : minimum === maximum
      ? `${selectedCount} / ${maximum} selected`
      : `${selectedCount} selected · choose ${minimum}–${maximum}`;

  return Object.freeze({
    selectedCount,
    maximumReached,
    renderedSelectionValid,
    validateEnabled,
    countLabel,
    unavailableChoiceIds,
  });
}

export function cardListDisplayEntries<
  T extends {
    readonly id: string;
    readonly label: string;
    readonly identityVisible: boolean;
  },
>(entries: readonly T[], alphabetical: boolean): readonly T[] {
  if (!alphabetical || !cardListAlphabeticalAllowed(entries)) return entries;
  return [...entries].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

const CARD_LIST_SOURCE_LABELS = {
  hand: "Hand",
  extra: "Extra Deck",
  graveyard: "Graveyard",
  banished: "Banished",
  deck: "Deck",
} as const;

export function cardListBrowseTitle(
  zone: BoardStackView["zone"],
): "Deck" | "Extra Deck" | "Graveyard" | "Banished" {
  return CARD_LIST_SOURCE_LABELS[zone];
}

export function cardListSourceNotice(
  entries: readonly Pick<OffFieldTargetEntry, "location">[],
): string {
  const represented = Object.entries(CARD_LIST_SOURCE_LABELS).flatMap(
    ([location, label]) =>
      entries.some((entry) => entry.location === location) ? [label] : [],
  );
  if (represented.length <= 1) return "Filtered: legal targets only";
  const last = represented.pop();
  return `Filtered: legal targets from ${represented.join(", ")}${represented.length > 1 ? "," : ""} and ${last}`;
}

export function cardListAlphabeticalAllowed(
  entries: readonly { readonly identityVisible: boolean }[],
): boolean {
  return (
    entries.length >= 2 &&
    entries.every(({ identityVisible }) => identityVisible)
  );
}
