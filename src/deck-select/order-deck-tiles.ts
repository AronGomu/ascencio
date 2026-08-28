import type { DeckSort, DeckTileModel } from "./deck-select-contracts.ts";

export function orderDeckTiles(
  tiles: readonly DeckTileModel[],
  sort: DeckSort,
): readonly DeckTileModel[] {
  /* An illegal deck sinks below every legal one whatever else it is flagged —
     the player cannot duel with it, so no favourite or default mark may lift
     it back up. Inside each half the default leads, then favourites, then the
     rest. */
  function rank(tile: DeckTileModel): number {
    const group = tile.legal ? 0 : 3;
    if (tile.isDefault) return group;
    if (tile.favourite) return group + 1;
    return group + 2;
  }

  function compare(a: DeckTileModel, b: DeckTileModel): number {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (a.updatedAt === null) return b.updatedAt === null ? 0 : 1;
    if (b.updatedAt === null) return -1;
    return b.updatedAt.localeCompare(a.updatedAt);
  }

  return Object.freeze(
    [...tiles].sort((a, b) => {
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      return compare(a, b);
    }),
  );
}
