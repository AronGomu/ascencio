import type { StoryRelease } from "../ports/story-release.ts";
import { isStoryState } from "./story-save-contracts.ts";
import type {
  StoryBinding,
  StorySaveEnvelope,
  StorySaveReadResult,
  StorySlotKey,
} from "./generation-contracts.ts";
const ENVELOPE_KEYS = [
  "schemaVersion",
  "slot",
  "revision",
  "savedAt",
  "state",
  "story",
];
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function dense(value: readonly unknown[]): boolean {
  return Array.from(value.keys()).every((index) => Object.hasOwn(value, index));
}
function exact(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") === [...keys].sort().join("\n")
  );
}
export function validBinding(
  value: unknown,
  release: StoryRelease,
): value is StoryBinding {
  if (
    !exact(value, ["chapterId", "contentId", "revision", "completedChapterIds"])
  )
    return false;
  const chapter = release.chapters.find((c) => c.id === value.chapterId);
  return (
    chapter?.document !== null &&
    chapter?.document !== undefined &&
    value.contentId === chapter.document.contentId &&
    value.revision === release.revision &&
    Array.isArray(value.completedChapterIds) &&
    dense(value.completedChapterIds) &&
    value.completedChapterIds.every(
      (id) =>
        typeof id === "string" && release.chapters.some((c) => c.id === id),
    ) &&
    new Set(value.completedChapterIds).size === value.completedChapterIds.length
  );
}
export function parseGenerationEnvelope(
  slot: StorySlotKey,
  value: unknown,
  release: StoryRelease,
): StorySaveReadResult {
  if (value === undefined) return { kind: "empty", slot };
  const corrupt = (reason: string): StorySaveReadResult => ({
    kind: "corrupt",
    slot,
    reason,
  });
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return corrupt("Save record is not an object");
  const row = value as Record<string, unknown>;
  if (count(row.schemaVersion) && row.schemaVersion !== 6)
    return { kind: "incompatible", slot, found: row.schemaVersion };
  if (
    !exact(row, ENVELOPE_KEYS) ||
    row.schemaVersion !== 6 ||
    row.slot !== slot ||
    !count(row.revision) ||
    row.revision < 1 ||
    !count(row.savedAt) ||
    !validBinding(row.story, release)
  )
    return corrupt("Saved story envelope is invalid");
  const binding = row.story;
  const chapter = release.chapters.find((c) => c.id === binding.chapterId)!;
  if (
    !isStoryState(row.state, chapter.document!.beats.length) ||
    !dense(row.state.locations) ||
    !dense(row.state.decks) ||
    (row.state.openedCards !== null && !dense(row.state.openedCards)) ||
    !row.state.decks.every(
      (deck) =>
        dense(deck.main) &&
        dense(deck.extra) &&
        dense(deck.side) &&
        dense(deck.validation.issues),
    )
  )
    return corrupt("Saved story state is invalid");
  // Never run legacy normalization or economy grants for schema6.
  return {
    kind: "ready",
    envelope: structuredClone(row) as unknown as StorySaveEnvelope,
  };
}
