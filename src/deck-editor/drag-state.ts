import type { DeckZone } from "../decks/contracts/index.ts";

export type PickedCard = Readonly<{
  code: number;
  source: "catalog" | DeckZone;
  index: number | null;
}>;
