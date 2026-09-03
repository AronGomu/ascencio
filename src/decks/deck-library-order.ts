import type { DeckId, DeckRecord } from "./deck-contracts.ts";

export type DeckLibrarySort = "modified" | "name";

export interface DeckLibraryOrderOptions {
  readonly defaultDeckId: DeckId | null;
  readonly sort: DeckLibrarySort;
}

export function orderDeckLibrary(
  decks: readonly DeckRecord[],
  options: DeckLibraryOrderOptions,
): readonly DeckRecord[] {
  const { defaultDeckId, sort } = options;

  function rank(deck: DeckRecord): 0 | 1 {
    return deck.id === defaultDeckId ? 0 : 1;
  }

  return Object.freeze(
    [...decks].sort((a, b) => {
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.updatedAt.localeCompare(a.updatedAt);
    }),
  );
}
