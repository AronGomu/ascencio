import type { Cards } from "../../cards/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type { DeckCardLists } from "../../decks/contracts/index.ts";

export interface EditorCatalogInput {
  readonly cards: Cards;
  readonly images: CardImageSource;
  readonly starter: Readonly<{ name: string; cards: DeckCardLists }>;
}
