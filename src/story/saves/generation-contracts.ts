import type { FactValue } from "../../modules/index.ts";
// src/story/saves/generation-contracts.ts; public through src/story/saves/index.ts
import type { StoryState } from "../model/story-state.ts";
export type StorySlotKey =
  `manual:${1 | 2 | 3}` | "autosave" | "checkpoint:pre-duel";
export interface StoryBinding {
  readonly chapterId: string;
  readonly contentId: string;
  readonly facts?: Readonly<Record<string, FactValue>>;
  readonly factsSchemaVersion?: 1;
  readonly beatId?: string;
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
  /** Checkpoint cleanup passes its owned revision; mismatch rejects without deleting. */
  clear(slot: StorySlotKey, expectedRevision?: number): Promise<void>;
}
