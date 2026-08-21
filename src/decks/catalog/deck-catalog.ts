import type { DeckBuilderCardView } from "./ocg-card-mapper.ts";

export interface DeckCatalogFilters {
  readonly name: string;
  readonly family: "monster" | "spell" | "trap" | null;
  readonly subtype: string | null;
  readonly attribute: string | null;
  readonly race: string | null;
}

export const EMPTY_CATALOG_FILTERS: DeckCatalogFilters = Object.freeze({
  name: "",
  family: null,
  subtype: null,
  attribute: null,
  race: null,
});

/* The UI filters through `filterDeckCatalogIndex` (`deck-catalog-index.ts`).
   This is the obvious implementation of the same predicate, kept as the oracle
   the indexed one is proved against: `deck-catalog-index.test.ts` asserts the
   two agree over generated filters, and `deck-catalog-performance.test.ts`
   times them side by side. It has no production caller — if the differential
   test goes, this goes with it. */
export function filterDeckCatalog(
  cards: readonly DeckBuilderCardView[],
  filters: DeckCatalogFilters,
): readonly DeckBuilderCardView[] {
  const name = filters.name.trim().toLocaleLowerCase();
  return Object.freeze(
    cards.filter(
      (card) =>
        (name.length === 0 || card.name.toLocaleLowerCase().includes(name)) &&
        (filters.family === null || card.family === filters.family) &&
        (filters.subtype === null || card.subtypes.includes(filters.subtype)) &&
        (filters.attribute === null || card.attribute === filters.attribute) &&
        (filters.race === null || card.race === filters.race),
    ),
  );
}

export function catalogFilterOptions(cards: readonly DeckBuilderCardView[]): {
  readonly subtypes: readonly string[];
  readonly attributes: readonly string[];
  readonly races: readonly string[];
} {
  const values = (items: readonly (string | null)[]): readonly string[] =>
    Object.freeze(
      [
        ...new Set(items.filter((item): item is string => item !== null)),
      ].sort(),
    );
  return Object.freeze({
    subtypes: values(cards.flatMap((card) => card.subtypes)),
    attributes: values(cards.map((card) => card.attribute)),
    races: values(cards.map((card) => card.race)),
  });
}
