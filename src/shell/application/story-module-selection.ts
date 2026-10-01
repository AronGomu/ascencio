import {
  DEFAULT_CHAPTER_MODULE,
  isChapterModule,
} from "../../modules/index.ts";
import { progressSatisfied } from "../../modules/index.ts";
import {
  createSqliteStoryRepository,
  type StorySaveEnvelope,
} from "../../story/saves/index.ts";
import type {
  LocalStorageClient,
  PackageStack,
  ChapterConfig,
} from "../../storage/index.ts";
import type { StorySessionRequest } from "../core/shell-application.ts";

export interface SelectedStoryModule {
  readonly chapterId: `chapter-${string}`;
  readonly previous: StorySaveEnvelope | null;
  readonly advancing: boolean;
}
/** Installed dependencies are checked by the registry; these prerequisites read only the save. */
export async function selectStoryModule(
  storage: LocalStorageClient,
  stack: PackageStack,
  request: StorySessionRequest,
  signal: AbortSignal,
): Promise<SelectedStoryModule> {
  const chapters = stack.packages
    .filter((item) => item.packageType === "chapter")
    .sort(
      (a, b) => Number(a.packageId.slice(8)) - Number(b.packageId.slice(8)),
    );
  if (request.intent === "new") {
    if (!chapters.some((item) => item.packageId === "chapter-01"))
      throw new Error("STORY_MODULE_UNAVAILABLE:chapter-01");
    return { chapterId: "chapter-01", previous: null, advancing: false };
  }
  const saves = createSqliteStoryRepository(storage.userData);
  const slots = request.checkpoint
    ? ["checkpoint:pre-duel" as const]
    : [
        "autosave" as const,
        "manual:1" as const,
        "manual:2" as const,
        "manual:3" as const,
      ];
  const rows = await Promise.all(slots.map((slot) => saves.read(slot)));
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (rows.some((row) => row.kind === "corrupt" || row.kind === "incompatible"))
    throw new Error("STORY_SAVE_UNAVAILABLE");
  const previous =
    rows
      .flatMap((row) => (row.kind === "ready" ? [row.envelope] : []))
      .sort((a, b) => b.savedAt - a.savedAt || b.revision - a.revision)[0] ??
    null;
  const current = previous?.story.chapterId ?? "chapter-01";
  const progress = {
    schemaVersion: 1 as const,
    completedChapterIds: previous?.story.completedChapterIds ?? [],
    facts: previous?.story.facts ?? {},
  };
  const advance =
    request.intent === "continue" &&
    !request.checkpoint &&
    progress.completedChapterIds.includes(current);
  const ids = request.chapterId
    ? [request.chapterId]
    : advance
      ? [
          ...chapters
            .filter(
              (item) =>
                Number(item.packageId.slice(8)) > Number(current.slice(8)),
            )
            .map((item) => item.packageId),
          current,
        ]
      : [current];
  for (const id of ids) {
    if (!chapters.some((item) => item.packageId === id)) continue;
    const config = await storage.content.query(
      { kind: "config", packageId: id as `chapter-${string}` },
      signal,
    );
    if (config.kind === "failed") throw new Error(config.error.code);
    const chapter = config.value as ChapterConfig;
    if (!("chapterNumber" in chapter)) throw new Error("STORY_MODULE_INVALID");
    const module = chapter.module ?? DEFAULT_CHAPTER_MODULE;
    if (!isChapterModule(module)) throw new Error("STORY_MODULE_INCOMPATIBLE");
    if (!progressSatisfied(progress, module.requiresProgress)) {
      if (request.chapterId || id === current)
        throw new Error(`STORY_PROGRESS_REQUIRED:${id}`);
      continue;
    }
    return {
      chapterId: id as `chapter-${string}`,
      previous,
      advancing: previous !== null && id !== current,
    };
  }
  throw new Error(`STORY_MODULE_UNAVAILABLE:${current}`);
}
