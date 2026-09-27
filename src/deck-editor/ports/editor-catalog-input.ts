import type { Cards } from "../../cards/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type { DeckCardLists } from "../../decks/contracts/index.ts";

import type { PinnedDeckRuleset } from "../../decks/validation/index.ts";

export interface EditorCatalogInput {
  readonly ruleset: PinnedDeckRuleset;
  readonly cards: Cards;
  readonly images: CardImageSource;
  readonly starter: Readonly<{ name: string; cards: DeckCardLists }>;
}
