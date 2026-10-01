import {
  validRequirements,
  stableReference,
  type ProgressRequirement,
} from "./progress.ts";

/** Versioned gameplay contract; package dependencies describe installed files only. */
export interface ChapterModule {
  readonly apiVersion: 1;
  readonly requiresProgress: readonly ProgressRequirement[];
  readonly completion: readonly ProgressRequirement[];
  readonly choiceBeatId: string | null;
}
export const DEFAULT_CHAPTER_MODULE: ChapterModule = Object.freeze({
  apiVersion: 1,
  requiresProgress: Object.freeze([]),
  completion: Object.freeze([]),
  choiceBeatId: "choice-pause",
});
export function isChapterModule(value: unknown): value is ChapterModule {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join() ===
      "apiVersion,choiceBeatId,completion,requiresProgress" &&
    record.apiVersion === 1 &&
    validRequirements(record.requiresProgress) &&
    validRequirements(record.completion) &&
    (record.choiceBeatId === null || stableReference(record.choiceBeatId))
  );
}
