/** Grouping belongs to the saved draw, not definitions that may later change. */
export function validOpenedPackSizes(
  sizes: unknown,
  cards: unknown,
): sizes is readonly number[] | null | undefined {
  if (sizes === undefined) return true;
  if (cards === null) return sizes === null;
  return (
    Array.isArray(cards) &&
    Array.isArray(sizes) &&
    sizes.length <= 1000 &&
    Object.keys(sizes).length === sizes.length &&
    sizes.every(
      (size) => Number.isSafeInteger(size) && size >= 1 && size <= 100,
    ) &&
    sizes.reduce((sum, size) => sum + size, 0) === cards.length
  );
}
export function openedPackSizes(
  cards: readonly unknown[],
  sizes?: readonly number[] | null,
): readonly number[] {
  return sizes !== null &&
    sizes !== undefined &&
    validOpenedPackSizes(sizes, cards)
    ? sizes
    : Array.from({ length: Math.ceil(cards.length / 9) }, (_, index) =>
        Math.min(9, cards.length - index * 9),
      );
}
