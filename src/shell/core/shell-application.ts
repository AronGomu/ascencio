import type { StoryBinding } from "../../story/saves/index.ts";
import type { StoryState } from "../../story/index.ts";
import type {
  BattlePresentationInput,
  BattleRuntimeSource,
} from "../../battle/ports/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type { Cards } from "../../cards/index.ts";
import type { EditorCatalogInput } from "../../deck-editor/ports/index.ts";
import type { LocalStorageClient } from "../../storage/index.ts";
import type {
  StoryMedia,
  StoryRelease,
  StorySet,
} from "../../story/ports/index.ts";
import type { GenerationSaveRepository } from "../../story/saves/index.ts";
import type { ShellGameplay } from "./installed-inputs.ts";
import type { ShellUserServices } from "./user-services.ts";

export interface FreeplayInputs {
  readonly collectionSets: readonly Pick<StorySet, "cards">[];
  readonly users: ShellUserServices;
  readonly cards: Cards;
  readonly images: CardImageSource;
  readonly battle: BattleRuntimeSource;
  readonly presentation: BattlePresentationInput;
  readonly editor: EditorCatalogInput;
}
export interface StorySessionRequest {
  readonly intent: "new" | "continue" | "load" | null;
  readonly chapterId?: `chapter-${string}`;
  readonly checkpoint?: boolean;
}
export interface StoryInputs {
  readonly entry?: {
    readonly autosaveRevision: number;
    readonly state: StoryState;
    readonly story: StoryBinding;
  };
  readonly users: ShellUserServices;
  readonly gameplay: ShellGameplay;
  readonly cards: Cards;
  readonly release: StoryRelease;
  readonly media: StoryMedia;
  readonly saves: GenerationSaveRepository;
}
export interface FreeplaySession {
  readonly kind: "freeplay";
  readonly generation: number;
  readonly inputs: FreeplayInputs;
  close(): Promise<void>;
}
export interface StorySession {
  readonly kind: "story";
  readonly generation: number;
  readonly inputs: StoryInputs;
  close(): Promise<void>;
}
export interface SessionByMode {
  readonly freeplay: FreeplaySession;
  readonly story: StorySession;
}
export interface ShellApplication {
  acquire<M extends keyof SessionByMode>(
    mode: M,
    signal: AbortSignal,
    story?: StorySessionRequest,
  ): Promise<SessionByMode[M]>;
  clear(): void;
  close(): void;
  subscribe(listener: () => void): () => void;
}
export type LoadFreeplayInputs = (
  storage: LocalStorageClient,
  users: ShellUserServices,
  signal: AbortSignal,
) => Promise<FreeplayInputs>;
export type LoadStoryInputs = (
  storage: LocalStorageClient,
  users: ShellUserServices,
  chapterId: `chapter-${string}`,
  signal: AbortSignal,
) => Promise<StoryInputs>;
