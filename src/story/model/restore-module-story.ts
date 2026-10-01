import type { StoryDocument } from "../ports/story-release.ts";
import type { StoryBinding } from "../saves/generation-contracts.ts";
import type { StoryState } from "./story-state.ts";

/** A scene ID survives insertion/reordering; old saves retain their index fallback. */
export function resolveSavedBeat(
  state: StoryState,
  binding: StoryBinding,
  document: StoryDocument,
): number {
  const index =
    binding.beatId === undefined
      ? state.narrativeIndex
      : document.beats.findIndex((beat) => beat.id === binding.beatId);
  if (
    binding.contentId !== document.contentId ||
    index < 0 ||
    index >= document.beats.length
  )
    throw new Error(
      "The saved scene is unavailable in this chapter version. Restore the matching module to continue.",
    );
  return index;
}
