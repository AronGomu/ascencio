import type { DeckBuilderCardView } from "../../decks/catalog/index.ts";

export interface BattlePresentationDeck {
  readonly id: string;
  readonly name: string;
  readonly main: readonly number[];
  readonly extra: readonly number[];
  readonly side: readonly number[];
}

export interface BattlePresentationOpponent {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly deckId: string;
}

export interface BattlePresentationInput {
  readonly snapshotId: string;
  readonly catalogRevision: string;
  readonly cards: readonly DeckBuilderCardView[];
  readonly decks: readonly BattlePresentationDeck[];
  readonly opponents: readonly BattlePresentationOpponent[];
  readonly defaults: Readonly<{
    starterDeckId: string;
    opponentId: string;
  }>;
}
