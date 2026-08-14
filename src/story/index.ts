/** Public contract of the visual-novel domain. The shell and any later
    cross-domain caller import from here only — nothing reaches past this file
    into `screens/`, `overlays/` or `model/`. */
export { default } from "./StoryApp.svelte";
export type { StoryState } from "./model/story-state.ts";
/* A battle handoff is identified by the map node it was launched from, so the
   public name for that id is the encounter it starts. */
export type { LocationId as EncounterId } from "./model/story-state.ts";
/* The admin console resets story progress, so the key it writes under is part
   of the domain's contract rather than something a caller reaches in for. */
export { STORY_STORAGE_KEY } from "./storage/story-storage.ts";
