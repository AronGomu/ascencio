import type { ChapterCard } from "./chapter-card.ts";
import type { ChapterDeck } from "./chapter-deck.ts";
import type { ChapterGameplay } from "./chapter-gameplay.ts";
import type { ChapterId } from "./chapter-id.ts";
import type { ChapterOpponent } from "./chapter-opponent.ts";
import type { ChapterSet } from "./chapter-set.ts";
import type { ContentSetRef } from "./content-set-ref.ts";

export interface InstalledGameplay {
  readonly content: ContentSetRef;
  readonly chapterIds: readonly ChapterId[];
  readonly cards: readonly ChapterCard[];
  readonly sets: readonly ChapterSet[];
  readonly decks: readonly ChapterDeck[];
  readonly opponents: readonly ChapterOpponent[];
  readonly defaults: ChapterGameplay["defaults"];
}
