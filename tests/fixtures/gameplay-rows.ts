import type { StoryRarity } from "../../src/story/ports/index.ts";

/** Test authored rows, never a production delivery format. */
interface FixtureMediaRef {
  readonly packId: "runtime" | `chapter-${string}`;
  readonly path: string;
}

export interface ChapterCard {
  readonly code: number;
  readonly record: {
    readonly code: number;
    readonly alias: number;
    readonly setcodes: readonly number[];
    readonly type: number;
    readonly level: number;
    readonly attribute: number;
    readonly race: string;
    readonly attack: number;
    readonly defense: number;
    readonly lscale: number;
    readonly rscale: number;
    readonly linkMarker: number;
    readonly ot: number;
  };
  readonly text: {
    readonly code: number;
    readonly name: string;
    readonly description: string;
    readonly strings: readonly string[];
  };
  readonly fullImage: FixtureMediaRef;
  readonly croppedImage: FixtureMediaRef;
}

export interface ChapterSet {
  readonly id: string;
  readonly name: string;
  readonly releaseYear: number;
  readonly image: FixtureMediaRef | null;
  readonly cards: readonly {
    readonly code: number;
    readonly name: string;
    readonly rarity: StoryRarity;
    readonly printingCode: string;
    readonly sourceRarity: string;
    readonly sourceRarityCode: string;
  }[];
}
export interface ChapterDeck {
  readonly id: string;
  readonly name: string;
  readonly main: readonly number[];
  readonly extra: readonly number[];
  readonly side: readonly number[];
}
export interface ChapterOpponent {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly deckId: string;
  readonly policyId: "basic";
}
