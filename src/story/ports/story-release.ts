import type { StoryEventChain } from "./story-event-chain.ts";
import type { ChapterModule, CommerceContent } from "../../modules/index.ts";
// src/story/ports/story-release.ts; public through src/story/ports/index.ts
import type { CardCode } from "../../cards/index.ts";
import type { DeckCardLists } from "../../decks/contracts/index.ts";
export type StoryChoiceId = string;
export type StoryRarity =
  | "common"
  | "rare"
  | "super-rare"
  | "ultra-rare"
  | "secret-rare"
  | "ultimate-rare"
  | "ghost-rare";
export interface StoryDocument {
  readonly chain?: StoryEventChain;
  readonly schemaVersion: 1;
  readonly contentId: string;
  readonly title: string;
  readonly beats: readonly {
    readonly id: string;
    readonly speaker: "Rin" | "Kael" | "Protagonist" | null;
    readonly kind: "dialogue" | "narration" | "thought";
    readonly text: string;
    readonly background: "station" | "concourse" | "arena";
    readonly characters: readonly ("rin-neutral" | "rin-smile" | "kael")[];
  }[];
  readonly choices: readonly {
    readonly id: StoryChoiceId;
    readonly label: string;
  }[];
  readonly choiceResponses: Readonly<Record<StoryChoiceId, string>>;
  readonly laterAcknowledgments: Readonly<Record<StoryChoiceId, string>>;
}
export interface StorySet {
  readonly id: string;
  readonly name: string;
  readonly releaseYear: number;
  readonly cards: readonly {
    readonly code: CardCode;
    readonly name: string;
    readonly rarity: StoryRarity;
    readonly printingCode: string;
    readonly sourceRarity: string;
    readonly sourceRarityCode: string;
  }[];
}
export interface StoryRelease {
  readonly revision: number;
  readonly chapters: readonly {
    readonly id: string;
    readonly module?: ChapterModule;
    readonly commerce?: CommerceContent;
    readonly shopId?: string;
    readonly document: StoryDocument | null;
    readonly cardCodes: readonly CardCode[];
    readonly sets: readonly StorySet[];
    readonly decks: readonly (DeckCardLists & {
      readonly id: string;
      readonly name: string;
    })[];
    readonly opponents: readonly {
      readonly id: string;
      readonly name: string;
      readonly line: string;
      readonly deckId: string;
      readonly policyId: "basic";
    }[];
    readonly defaults: Readonly<{ starterDeckId: string; opponentId: string }>;
  }[];
}
export interface StoryMediaLease {
  readonly url: string;
  subscribe?(listener: (url: string) => void): () => void;
  release(): void;
}
export interface StoryMedia {
  acquireEvent?(
    chapterId: string,
    logicalId: string,
    signal: AbortSignal,
  ): Promise<StoryMediaLease | null>;
  acquireMap(
    chapterId: string,
    signal: AbortSignal,
  ): Promise<StoryMediaLease | null>;
  acquireSetImage(
    setId: string,
    signal: AbortSignal,
  ): Promise<StoryMediaLease | null>;
}

export {
  parseStoryRelease,
  validateStoryRelease,
} from "./parse-story-release.ts";
export { validateStoryContinuity } from "./story-continuity.ts";
