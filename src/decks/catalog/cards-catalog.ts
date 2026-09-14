import type { Cards } from "../../cards/index.ts";
import { sortDeckCatalogCards } from "./deck-catalog-order.ts";
import {
  adaptAssetDeckCard,
  mapDeckBuilderCard,
  type DeckBuilderCardView,
} from "./ocg-card-mapper.ts";

export function cardsDeckCatalog(cards: Cards): readonly DeckBuilderCardView[] {
  return Object.freeze(
    sortDeckCatalogCards(
      cards.all().map((definition) =>
        mapDeckBuilderCard(
          adaptAssetDeckCard(
            {
              ...definition,
              setcodes: [...definition.setcodes],
              ot: definition.scope,
            },
            definition,
          ),
        ),
      ),
    ),
  );
}

export { validatePublishedDecks } from "../validation/validate-published-decks.ts";
