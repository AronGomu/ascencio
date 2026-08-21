import type { DeckId, DeckRecord } from "./deck-contracts.ts";

export type DeckLibrarySort = "modified" | "name";

export interface DeckLibraryOrderOptions {
  readonly defaultDeckId: DeckId | null;
  readonly favouriteDeckIds: readonly DeckId[];
  readonly sort: DeckLibrarySort;
}

export function orderDeckLibrary(
  decks: readonly DeckRecord[],
  options: DeckLibraryOrderOptions,
): readonly DeckRecord[] {
  const { defaultDeckId, favouriteDeckIds, sort } = options;
  const favourites = new Set(favouriteDeckIds);

  function rank(deck: DeckRecord): 0 | 1 | 2 {
    if (deck.id === defaultDeckId) return 0;
    if (favourites.has(deck.id)) return 1;
    return 2;
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
