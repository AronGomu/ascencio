import {
  createInitialStoryState,
  type StoryState,
} from "../model/story-state.ts";
import type {
  StoryBinding,
  StorySaveEnvelope,
} from "./generation-contracts.ts";
import type { StoryRelease } from "../ports/story-release.ts";

export function chapterTransition(
  previous: StorySaveEnvelope,
  release: StoryRelease,
): { readonly state: StoryState; readonly story: StoryBinding } {
  const chapter = release.chapters.find((chapter) => chapter.document !== null);
  if (!chapter) throw new Error("STORY_MODULE_UNAVAILABLE");
  const initial = createInitialStoryState();
  return {
    state: {
      ...initial,
      screen: "narrative",
      savedScreen: "narrative",
      progressExists: true,
      narrativeIndex: chapter.document!.chain
        ? chapter.document!.beats.findIndex(
            (b) => b.id === chapter.document!.chain!.entryBeatId,
          )
        : 0,
      ...(chapter.document!.chain
        ? { visitedBeatIds: [chapter.document!.chain.entryBeatId] }
        : {}),
      dp: previous.state.dp,
      boosters: structuredClone(previous.state.boosters),
      collection: structuredClone(previous.state.collection),
      decks: structuredClone(previous.state.decks),
      defaultDeckId: previous.state.defaultDeckId,
    },
    story: {
      ...previous.story,
      chapterId: chapter.id,
      contentId: chapter.document!.contentId,
      revision: release.revision,
      beatId:
        chapter.document!.chain?.entryBeatId ?? chapter.document!.beats[0]!.id,
    },
  };
}
