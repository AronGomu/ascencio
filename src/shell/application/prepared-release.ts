import type { Cards } from "../../cards/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type {
  ProgressiveContentStore,
  StagedContent,
} from "../../content/index.ts";
import type { EditorCatalogInput } from "../../deck-editor/ports/index.ts";
import type { StoryMedia, StoryRelease } from "../../story/ports/index.ts";
import type { BattleRuntimeSource } from "../../battle/ports/index.ts";
import { createProgressiveReleaseMedia } from "../adapters/progressive-release-media.ts";
import { readProgressiveReleaseData } from "../adapters/progressive-release-data.ts";
import { validateReleaseData } from "../release-validation.ts";

export interface PreparedRelease {
  readonly content: StagedContent;
  readonly cards: Cards;
  readonly images: CardImageSource;
  readonly editor: EditorCatalogInput;
  readonly story: StoryRelease;
  readonly storyMedia: StoryMedia;
  readonly battle: BattleRuntimeSource;
  dispose(): void;
}

export async function prepareRelease(
  store: ProgressiveContentStore,
  content: StagedContent,
  signal: AbortSignal,
): Promise<PreparedRelease> {
  try {
    content = snapshotStagedContent(content);
    const data = await readProgressiveReleaseData(store, content, signal);
    const media = createProgressiveReleaseMedia(
      store,
      content,
      data.manifest,
      data.imageRefs,
      data.mapRefs,
      data.setImageRefs,
    );
    try {
      const runtime = await data.battle.load(signal);
      validateReleaseData({
        chapterCards: data.chapterCards,
        runtimeCards: data.runtimeCards,
        story: data.story,
        runtime,
        previousStory: null,
      });
      const first = data.story.chapters[0];
      const starter =
        first === undefined
          ? undefined
          : data.story.chapters
              .flatMap(({ decks }) => decks)
              .find(({ id }) => id === first.defaults.starterDeckId);
      if (starter === undefined) throw new Error("STORY_RELEASE_INVALID");
      const editor: EditorCatalogInput = Object.freeze({
        cards: data.cards,
        images: media.images,
        starter: Object.freeze({
          name: starter.name,
          cards: Object.freeze({
            main: starter.main,
            extra: starter.extra,
            side: starter.side,
          }),
        }),
      });
      return Object.freeze({
        content,
        cards: data.cards,
        images: media.images,
        editor,
        story: data.story,
        storyMedia: media.story,
        battle: data.battle,
        dispose: media.dispose,
      });
    } catch (error) {
      media.dispose();
      throw error;
    }
  } catch (cause) {
    throw new Error("APP_REQUIRED_INPUT_FAILED", { cause });
  }
}

function snapshotStagedContent(value: StagedContent): StagedContent {
  const copy = structuredClone(value);
  if (
    typeof copy.receiptId !== "string" ||
    !/^[a-f0-9]{64}$/.test(copy.receiptId) ||
    typeof copy.manifestVersion !== "string" ||
    !/^[a-f0-9]{64}$/.test(copy.manifestVersion) ||
    !Number.isSafeInteger(copy.releaseSequence) ||
    copy.releaseSequence < 1 ||
    !Array.isArray(copy.chapterIds) ||
    copy.chapterIds.length < 1 ||
    copy.chapterIds.length > 99 ||
    copy.chapterIds.some(
      (id, index) =>
        typeof id !== "string" ||
        !/^chapter-(0[1-9]|[1-9][0-9])$/.test(id) ||
        (index > 0 && copy.chapterIds[index - 1]! >= id),
    ) ||
    Object.keys(copy).sort().join(",") !==
      "chapterIds,manifestVersion,receiptId,releaseSequence"
  )
    throw new Error("APP_REQUIRED_INPUT_FAILED");
  return Object.freeze({
    ...copy,
    chapterIds: Object.freeze([...copy.chapterIds]),
  });
}
