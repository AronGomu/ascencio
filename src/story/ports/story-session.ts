import type { StoryBinding } from "../saves/generation-contracts.ts";
import type { StoryRelease } from "./story-release.ts";
/** Current prologue is the playable chapter; later chapter documents may be null. */
export function storySession(release: StoryRelease): {
  readonly chapter: StoryRelease["chapters"][number];
  readonly binding: StoryBinding;
} {
  const chapter = release.chapters.find((c) => c.document !== null);
  if (!chapter) throw new Error("STORY_RELEASE_INVALID");
  return {
    chapter,
    binding: {
      chapterId: chapter.id,
      contentId: chapter.document!.contentId,
      revision: release.revision,
      completedChapterIds: [],
    },
  };
}
