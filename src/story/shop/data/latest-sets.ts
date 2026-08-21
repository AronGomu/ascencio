import type { ShopSetEntry } from "./shop-set-data.ts";

/** The newest released sets, oldest first, for the shop's "Latest Released" row.
    A year is the whole date the data carries, so sets sharing one keep the
    order the data lists them in — that file is already chronological, and a
    comparison on year alone would otherwise reorder a year's sets arbitrarily.
    Fewer released sets than asked for yields all of them rather than padding. */
export function latestReleasedSets(
  sets: readonly ShopSetEntry[],
  count = 4,
): readonly ShopSetEntry[] {
  const released = sets.filter((entry) => entry.released);
  const chronological = [...released].sort(
    (left, right) => left.releaseYear - right.releaseYear,
  );
  return chronological.slice(Math.max(0, chronological.length - count));
}
