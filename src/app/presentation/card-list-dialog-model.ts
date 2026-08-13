import type { BoardStackView } from "../../field/board-view-model.ts";
import type { OffFieldTargetEntry } from "../../field/off-field-target-list.ts";

export function cardListDisplayEntries<
  T extends {
    readonly id: string;
    readonly label: string;
    readonly identityVisible: boolean;
  },
>(entries: readonly T[], alphabetical: boolean): readonly T[] {
  if (!alphabetical || !cardListAlphabeticalAllowed(entries)) return entries;
  return entries
    .map((entry, sourceIndex) => ({ entry, sourceIndex }))
    .sort(
      (left, right) =>
        left.entry.label.localeCompare(right.entry.label) ||
        left.sourceIndex - right.sourceIndex,
    )
    .map(({ entry }) => entry);
}

export function cardListBrowseTitle(
  zone: BoardStackView["zone"],
): "Deck" | "Extra Deck" | "Graveyard" | "Banished" {
  switch (zone) {
    case "deck":
      return "Deck";
    case "extra":
      return "Extra Deck";
    case "graveyard":
      return "Graveyard";
    case "banished":
      return "Banished";
  }
}

export function cardListSourceNotice(
  entries: readonly Pick<OffFieldTargetEntry, "location">[],
): string {
  const sources = [
    ["hand", "Hand"],
    ["extra", "Extra Deck"],
    ["graveyard", "Graveyard"],
    ["banished", "Banished"],
    ["deck", "Deck"],
  ] as const;
  const represented = sources
    .filter(([location]) => entries.some((entry) => entry.location === location))
    .map(([, label]) => label);
  if (represented.length <= 1) return "Filtered: legal targets only";
  if (represented.length === 2)
    return `Filtered: legal targets from ${represented[0]} and ${represented[1]}`;
  return `Filtered: legal targets from ${represented.slice(0, -1).join(", ")}, and ${represented.at(-1)}`;
}

export function cardListAlphabeticalAllowed(
  entries: readonly { readonly identityVisible: boolean }[],
): boolean {
  return entries.length >= 2 && entries.every(({ identityVisible }) => identityVisible);
}
