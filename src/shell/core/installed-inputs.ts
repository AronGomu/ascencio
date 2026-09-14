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
export interface ShellSession {
  close(): void;
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
export type ShellResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "failed"; readonly code: string };
export interface ShellChapterSizes {
  readonly download: number;
  readonly installed: number;
  readonly deps: string;
}
export interface ShellInstallProgress {
  readonly phase:
    | "queued"
    | "extracting"
    | "complete"
    | "downloading"
    | "verifying"
    | "activating"
    | "paused"
    | "failed"
    | "cancelled";
  readonly verifiedDownloadBytes: number;
  readonly totalDownloadBytes: number;
}
export interface ShellInstaller extends ShellSession {
  current(): Promise<ShellResult<readonly string[]>>;
  subscribeCurrent(
    listener: (state: ShellResult<readonly string[]>) => void,
  ): () => void;
  descriptions(): Promise<
    ShellResult<Readonly<Record<string, ShellChapterSizes>>>
  >;
  install(
    chapterId: string,
    progress: (value: ShellInstallProgress) => void,
    signal: AbortSignal,
  ): Promise<
    | ShellResult<{
        readonly gameplay: ShellGameplay;
        readonly reader: ShellSession;
        readonly generation: number;
      }>
    | { readonly kind: "pending" }
  >;
}
export interface ShellBootstrap {
  readonly chapters: readonly {
    readonly id: string;
    readonly title: string;
    readonly description: string;
  }[];
  readonly available: boolean;
  openInstaller(): Promise<ShellResult<ShellInstaller>>;
}
