import type {
  AssetDeckCardRecord,
  DeckCatalogText,
} from "./ocg-card-mapper.ts";
import { sortDeckCatalogCards } from "./deck-catalog-order.ts";
import {
  adaptAssetDeckCard,
  mapDeckBuilderCard,
  type DeckBuilderCardView,
} from "./ocg-card-mapper.ts";

export function installedDeckCatalog<SetRecord>(
  gameplay: Readonly<{
    cards: readonly Readonly<{
      record: Omit<AssetDeckCardRecord, "setcodes"> & {
        readonly setcodes: readonly number[];
      };
      text: DeckCatalogText;
    }>[];
    sets: readonly SetRecord[];
  }>,
): Readonly<{
  cards: readonly DeckBuilderCardView[];
  sets: readonly SetRecord[];
}> {
  const cards = gameplay.cards.map(({ record, text }) =>
    mapDeckBuilderCard(
      adaptAssetDeckCard({ ...record, setcodes: [...record.setcodes] }, text),
    ),
  );
  return Object.freeze({
    cards: Object.freeze(sortDeckCatalogCards(cards)),
    sets: Object.freeze([...gameplay.sets]),
  });
}
