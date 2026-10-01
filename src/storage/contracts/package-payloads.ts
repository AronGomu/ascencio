import type { ChapterModule } from "../../modules/index.ts";
import type { BattleRuntimeInput } from "../../battle/ports/index.ts";
import type { CardDefinition } from "../../cards/index.ts";
import type { DeckCardLists } from "../../decks/contracts/index.ts";
import type { StoryDocument } from "../../story/ports/index.ts";

import type { GlobalSet } from "./global-set.ts";

export type CardRow = Omit<
  CardDefinition,
  "name" | "description" | "strings" | "images"
>;
export type SetRow = Omit<GlobalSet, "cards"> & {
  readonly imageAssetPath: string | null;
};
export type DeckRow = DeckCardLists;
export type StoryDocumentRow = StoryDocument;

export interface DuelCoreConfig {
  readonly coreVersion: readonly [11, 0];
  readonly wasmPath: "engine/ocgcore.sync.wasm";
  readonly vendorManifestPath: "engine/vendor-manifest.json";
  readonly strings: BattleRuntimeInput["strings"];
}

export interface CardLibraryConfig {
  readonly defaultLocale: "en";
  readonly locales: readonly string[];
  readonly revisions: BattleRuntimeInput["revisions"];
  readonly requiredScripts: BattleRuntimeInput["requiredScripts"];
}

export interface FreeplayConfig {
  readonly title: string;
  readonly defaults: Readonly<{
    starterDeckId: string;
    opponentId: string;
  }>;
  readonly rulesetId: string;
}

export interface ChapterConfig {
  readonly module?: ChapterModule;
  readonly title: string;
  readonly chapterNumber: number;
  readonly storyContentId: StoryDocument["contentId"] | null;
  readonly defaults: Readonly<{
    starterDeckId: string;
    opponentId: string;
  }>;
  readonly setIds: readonly string[];
  readonly mapAssetPath: string | null;
}

export type PackageConfig =
  DuelCoreConfig | CardLibraryConfig | FreeplayConfig | ChapterConfig;
