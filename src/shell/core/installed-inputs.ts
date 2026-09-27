import type { Cards } from "../../cards/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type {
  BattlePresentationInput,
  BattleRuntimeSource,
} from "../../battle/ports/index.ts";
import type { StorySet } from "../../story/ports/index.ts";
import type { EditorCatalogInput } from "../../deck-editor/ports/index.ts";

export interface ShellImageLibrary {
  readonly cardUrls: ReadonlyMap<number, string>;
  readonly setUrls: ReadonlyMap<string, string>;
  dispose(): void;
}
export interface ShellGameplay {
  readonly identity: string;
  readonly chapterIds: readonly string[];
  readonly presentation: BattlePresentationInput;
  readonly cards: Cards;
  readonly sets: readonly StorySet[];
  readonly decks: BattlePresentationInput["decks"];
  readonly opponents: readonly (BattlePresentationInput["opponents"][number] & {
    readonly policyId: "basic";
  })[];
  readonly defaults: BattlePresentationInput["defaults"];
  readonly battle: BattleRuntimeSource;
  editor(images?: CardImageSource): EditorCatalogInput;
  images(signal?: AbortSignal): Promise<ShellImageLibrary>;
  cardImages(
    report: (status: {
      readonly kind: "missing-media";
      readonly reason: "missing" | "corrupt" | "unreadable";
    }) => void,
  ): Promise<CardImageSource>;
}
