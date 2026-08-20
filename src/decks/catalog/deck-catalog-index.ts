import type { DeckBuilderCardView } from "./ocg-card-mapper.ts";
import type { DeckCatalogFilters } from "./deck-catalog.ts";

export interface DeckCatalogIndex {
  readonly cards: readonly DeckBuilderCardView[];
  /** `cards[i].name.toLocaleLowerCase()`, computed once. */
  readonly lowerNames: readonly string[];
}

export function buildDeckCatalogIndex(
  cards: readonly DeckBuilderCardView[],
): DeckCatalogIndex {
  return {
    cards,
    lowerNames: cards.map((c) => c.name.toLocaleLowerCase()),
  };
}

export function filterDeckCatalogIndex(
  index: DeckCatalogIndex,
  filters: DeckCatalogFilters,
): readonly DeckBuilderCardView[] {
  const name = filters.name.trim().toLocaleLowerCase();
  const { cards, lowerNames } = index;
  const out: DeckBuilderCardView[] = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    if (name.length > 0 && !lowerNames[i]!.includes(name)) continue;
    if (filters.family !== null && card.family !== filters.family) continue;
    if (filters.subtype !== null && !card.subtypes.includes(filters.subtype))
      continue;
    if (filters.attribute !== null && card.attribute !== filters.attribute)
      continue;
    if (filters.race !== null && card.race !== filters.race) continue;
    out.push(card);
  }
  return Object.freeze(out);
}
