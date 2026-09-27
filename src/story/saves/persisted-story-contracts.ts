import type { StoryState, StoryLocationState } from "../model/story-state.ts";
import type {
  StoryBinding,
  StorySaveEnvelope,
  StorySaveReadResult,
} from "./generation-contracts.ts";

/** Storage preserves authored references even when gameplay no longer knows them. */
export interface PersistedStoryState extends Omit<
  StoryState,
  "choice" | "encounterId" | "locations" | "decks"
> {
  readonly decks: readonly (Omit<
    StoryState["decks"][number],
    "id" | "validation" | "illustrationCardCode"
  > & {
    readonly id: string;
    readonly illustrationCardCode?: number | null;
    readonly validation: {
      readonly status: "valid" | "warnings" | "errors";
      readonly issues: readonly unknown[];
      readonly rulesetRevision: string;
    };
  })[];
  readonly choice: string | null;
  readonly encounterId: string | null;
  readonly locations: readonly (Omit<StoryLocationState, "id"> & {
    readonly id: string;
  })[];
}

export interface PersistedStoryEnvelope extends Omit<
  StorySaveEnvelope,
  "state" | "story"
> {
  readonly state: PersistedStoryState;
  readonly story: Omit<StoryBinding, "contentId"> & {
    readonly contentId: string;
  };
}

export type StoredStoryReadResult =
  | Exclude<StorySaveReadResult, { readonly kind: "ready" }>
  | { readonly kind: "ready"; readonly envelope: PersistedStoryEnvelope };
