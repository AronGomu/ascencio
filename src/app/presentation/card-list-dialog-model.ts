import type { BoardStackView } from "../../field/board-view-model.ts";

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

export function cardListAlphabeticalAllowed(
  entries: readonly { readonly identityVisible: boolean }[],
): boolean {
  return entries.length >= 2 && entries.every(({ identityVisible }) => identityVisible);
}
