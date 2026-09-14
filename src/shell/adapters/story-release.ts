import {
  parseChapterGameplay,
  parseChapterStoryDocument,
  type ChapterFileRef,
  type ContentReader,
  type StagedContent,
} from "../../content/index.ts";
import { cardCode } from "../../cards/index.ts";
import {
  parseStoryRelease,
  type StoryMedia,
  type StoryMediaLease,
  type StoryRelease,
} from "../../story/ports/index.ts";
/** Translation only: Story owns semantic validation; media reads never gate release. */
export async function readStagedStory(
  reader: ContentReader,
  staged: StagedContent,
  signal: AbortSignal,
): Promise<{ readonly release: StoryRelease; readonly media: StoryMedia }> {
  await reader.verifyRequired(staged, signal);
  const manifest = await reader.readManifest(staged.manifestVersion);
  if (manifest.releaseSequence !== staged.releaseSequence)
    throw new Error("STORY_RELEASE_INVALID");
  const maps = new Map<string, ChapterFileRef>(),
    images = new Map<string, ChapterFileRef>();
  async function json(path: string): Promise<unknown> {
    const bytes = await reader.readFile(staged.manifestVersion, path, signal);
    if (bytes === null) throw new Error("STORY_RELEASE_INVALID");
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new Error("STORY_RELEASE_INVALID");
    }
  }
  const chapters = await Promise.all(
    staged.chapterIds.map(async (id) => {
      const entry = manifest.chapters.find((c) => c.id === id);
      if (!entry) throw new Error("STORY_RELEASE_INVALID");
      const parsed = parseChapterGameplay(await json(entry.gameplayPath));
      if (parsed.kind !== "ok" || parsed.value.chapterId !== id)
        throw new Error("STORY_RELEASE_INVALID");
      const gameplay = parsed.value;
      let document: StoryRelease["chapters"][number]["document"] = null;
      if (entry.storyPath !== null) {
        const parsedStory = parseChapterStoryDocument(
          await json(entry.storyPath),
        );
        if (parsedStory.kind !== "ok") throw new Error("STORY_RELEASE_INVALID");
        const { mapImage, ...semantic } = parsedStory.value;
        document = semantic;
        maps.set(id, mapImage);
      }
      for (const set of gameplay.sets)
        if (set.image !== null) images.set(set.id, set.image);
      return {
        id,
        document,
        cardCodes: gameplay.cards.map((c) => cardCode(c.code)),
        sets: gameplay.sets.map((set) => ({
          id: set.id,
          name: set.name,
          releaseYear: set.releaseYear,
          cards: set.cards.map((c) => ({ ...c, code: cardCode(c.code) })),
        })),
        decks: gameplay.decks,
        opponents: gameplay.opponents,
        defaults: gameplay.defaults,
      };
    }),
  );
  const release = parseStoryRelease({
    revision: staged.releaseSequence,
    chapters,
  });
  async function acquire(
    ref: ChapterFileRef | undefined,
    signal: AbortSignal,
  ): Promise<StoryMediaLease | null> {
    checkAbort(signal);
    if (ref === undefined) return null;
    let url: string | null = null;
    try {
      const file = manifest.files.find(
        (f) =>
          f.path === ref.path &&
          f.role === "media" &&
          f.packIds.includes(ref.packId),
      );
      if (!file) return null;
      const bytes = await reader.readFile(
        staged.manifestVersion,
        ref.path,
        signal,
      );
      checkAbort(signal);
      if (bytes === null) return null;
      url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: file.mediaType }),
      );
      let released = false;
      const leased = url;
      return {
        url: leased,
        release() {
          if (!released) {
            released = true;
            URL.revokeObjectURL(leased);
          }
        },
      };
    } catch {
      if (url !== null) URL.revokeObjectURL(url);
      checkAbort(signal);
      return null;
    }
  }
  return {
    release,
    media: {
      acquireMap: (id, signal) => acquire(maps.get(id), signal),
      acquireSetImage: (id, signal) => acquire(images.get(id), signal),
    },
  };
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted)
    throw new DOMException("The operation was aborted.", "AbortError");
}
