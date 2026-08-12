export const HAND_PAGE_SIZE = 10;

export interface HandPage<T> {
  readonly page: number;
  readonly pageCount: number;
  readonly start: number;
  readonly items: readonly T[];
  readonly canPrevious: boolean;
  readonly canNext: boolean;
}

export function handPage<T>(
  items: readonly T[],
  requestedPage: number,
): HandPage<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / HAND_PAGE_SIZE));
  const page = Math.min(Math.max(0, Math.trunc(requestedPage)), pageCount - 1);
  const start = page * HAND_PAGE_SIZE;
  const pageItems = Object.freeze(items.slice(start, start + HAND_PAGE_SIZE));
  return Object.freeze({
    page,
    pageCount,
    start,
    items: pageItems,
    canPrevious: page > 0,
    canNext: page < pageCount - 1,
  });
}
