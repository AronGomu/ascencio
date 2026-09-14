import type { InstalledGameplay } from "../../content/index.ts";
import { sortDeckCatalogCards } from "./deck-catalog-order.ts";
import {
  adaptAssetDeckCard,
  mapDeckBuilderCard,
  type DeckBuilderCardView,
} from "./ocg-card-mapper.ts";

export function installedDeckCatalog(gameplay: InstalledGameplay): Readonly<{
  cards: readonly DeckBuilderCardView[];
  sets: InstalledGameplay["sets"];
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
