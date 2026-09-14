// src/story/saves/generation-contracts.ts; public through src/story/saves/index.ts
import type { StoryState } from "../model/story-state.ts";
import type { StoryRelease } from "../ports/story-release.ts";
export type StoryGenerationId = string & {
  readonly __storyGenerationId: unique symbol;
};
export type StorySlotKey =
  `manual:${1 | 2 | 3}` | "autosave" | "checkpoint:pre-duel";
export interface StoryBinding {
  readonly chapterId: string;
  readonly contentId: "prototype-prologue-v1";
  readonly revision: number;
  readonly completedChapterIds: readonly string[];
}
export interface StorySaveEnvelope {
  readonly schemaVersion: 6;
  readonly slot: StorySlotKey;
  readonly revision: number;
  readonly savedAt: number;
  readonly state: StoryState;
  readonly story: StoryBinding;
}
export type StorySaveReadResult =
  | { readonly kind: "empty"; readonly slot: StorySlotKey }
  | { readonly kind: "ready"; readonly envelope: StorySaveEnvelope }
  | {
      readonly kind: "incompatible";
      readonly slot: StorySlotKey;
      readonly found: number;
    }
  | {
      readonly kind: "corrupt";
      readonly slot: StorySlotKey;
      readonly reason: string;
    };
export type StorySaveWriteResult =
  | { readonly kind: "written"; readonly revision: number }
  | { readonly kind: "stale"; readonly currentRevision: number }
  | {
      readonly kind: "failed";
      readonly reason: "quota" | "unavailable" | "unknown";
    };
export interface StorySaveSummary {
  readonly slot: StorySlotKey;
  readonly revision: number;
  readonly savedAt: number;
  readonly chapterLabel: string;
}
export interface GenerationSaveRepository {
  read(slot: StorySlotKey): Promise<StorySaveReadResult>;
  write(
    slot: StorySlotKey,
    state: StoryState,
    expectedRevision: number | null,
    story: StoryBinding,
  ): Promise<StorySaveWriteResult>;
  list(): Promise<readonly StorySaveSummary[]>;
  clear(slot: StorySlotKey): Promise<void>;
}
export interface StoryGenerationSeal {
  readonly generationId: StoryGenerationId;
  readonly sourceGenerationId: StoryGenerationId | null;
  readonly revision: number;
  readonly slots: readonly {
    readonly slot: StorySlotKey;
    readonly revision: number;
    readonly digest: string;
  }[];
}
export interface StoryMigrationPort {
  prepare(
    sourceGenerationId: StoryGenerationId | null,
    target: StoryRelease,
  ): Promise<StoryGenerationSeal>;
  verifySeal(seal: StoryGenerationSeal): Promise<void>;
  verifyActiveGeneration(
    generationId: StoryGenerationId,
    target: StoryRelease,
  ): Promise<void>;
  repository(generationId: StoryGenerationId): GenerationSaveRepository;
}
