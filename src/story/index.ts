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
/* A save owns its decks, so editing them is a save write like any other. The
   adapter presents them through the deck domain's own `DeckRepository`, which
   is what lets the editor open a story save without knowing it is one
   (ADR-049). Named here because the caller that binds it is the shell. */
export { createStoryDeckRepository } from "./decks/story-deck-repository.ts";
/* The one constructor of a story deck context, and the reason the shell needs
   nothing else from here to bind the editor: the save the player would resume,
   the repository over it, what it owns and the name for the editor's banner all
   come out of one read. The reducer stays behind this entry — a shell that
   dispatched story commands itself would own half a story. */
export { openStoryDeckContext } from "./decks/story-deck-context.ts";
/* What this save owns, for the screens that ask: the catalog it builds from,
   the legality of its decks, the sell dialog and the pre-battle gate. Only the
   story half of the contract is named here — `CardOwnership` itself and free
   play's `unlimitedCardOwnership()` ship from `src/decks/card-ownership.ts`,
   which records why. */
export { storyCardOwnership } from "./decks/card-ownership.ts";
/* The deck an encounter is fought with, resolved out of a save. The story
   itself calls this when the player presses Start; the shell calls it when a
   reload lands straight on a duel session, where the checkpoint is all there
   is and no story is mounted to resolve it. Both need the same three inputs
   the briefing used, so there is one resolver rather than two. */
export { encounterDeck } from "./decks/encounter-deck.ts";
