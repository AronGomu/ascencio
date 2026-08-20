/** Public contract of the visual-novel domain. The shell and any later
    cross-domain caller import from here only — nothing reaches past this file
    into `screens/`, `overlays/` or `model/`. */
export { default } from "./StoryApp.svelte";
export type { StoryState } from "./model/story-state.ts";
/* The duel handoff is a two-domain conversation, so its whole vocabulary is
   named here: the shell generates the handoff id, mounts the duel and settles
   exactly one result, while the story owns what each result means. */
export {
  acceptsResult,
  ENCOUNTER_LABELS,
  restoreStoryState,
  storyBattleResult,
  toStoryResolution,
} from "./handoff/story-handoff.ts";
export type {
  PendingStoryDuel,
  StoryDuelResolution,
  StoryEncounterIntent,
  StoryEncounterRequest,
  StoryHandoffOutcome,
} from "./handoff/story-handoff.ts";
/* A battle handoff is identified by the map node it was launched from, so the
   public name for that id is the encounter it starts. */
export type { EncounterId } from "./model/story-state.ts";
/* Story progress is persisted, so the store is part of the domain's contract:
   the admin console resets the database by name, and the duel handoff writes
   and restores the `checkpoint:pre-duel` slot through the repository. Every
   type reachable from `StorySaveRepository` is named here, or a caller could
   not annotate what it holds without reaching past this file. */
export { STORY_SAVES_DATABASE_NAME } from "./saves/story-save-contracts.ts";
export type {
  StorySaveEnvelope,
  StorySaveReadResult,
  StorySaveSummary,
  StorySaveWriteResult,
  StorySlotKey,
} from "./saves/story-save-contracts.ts";
export { createStorySaveRepository } from "./saves/story-save-repository.ts";
export type { StorySaveRepository } from "./saves/story-save-repository.ts";
