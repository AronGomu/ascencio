import type { StoryRelease } from "./story-release.ts";
import { parseStoryRelease } from "./parse-story-release.ts";
export function validateStoryContinuity(
  previous: StoryRelease,
  next: StoryRelease,
): void {
  try {
    const before = parseStoryRelease(previous),
      after = parseStoryRelease(next);
    if (after.revision < before.revision) throw new Error();
    for (const old of before.chapters) {
      const current = after.chapters.find((c) => c.id === old.id);
      if (!current) throw new Error();
      preserve(old.cardCodes, current.cardCodes);
      for (const key of ["sets", "decks", "opponents"] as const)
        preserve(
          old[key].map((v) => v.id),
          current[key].map((v) => v.id),
        );
      for (const oldSet of old.sets) {
        const target = current.sets.find((s) => s.id === oldSet.id)!;
        preserve(
          oldSet.cards.map(
            (c) => `${c.code}:${c.printingCode}:${c.sourceRarityCode}`,
          ),
          target.cards.map(
            (c) => `${c.code}:${c.printingCode}:${c.sourceRarityCode}`,
          ),
        );
      }
      if (old.document !== null) {
        const doc = current.document;
        if (doc === null || doc.contentId !== old.document.contentId)
          throw new Error();
        preserve(
          old.document.beats.map((b) => b.id),
          doc.beats.map((b) => b.id),
        );
        preserve(
          old.document.choices.map((c) => c.id),
          doc.choices.map((c) => c.id),
        );
        preserve(
          old.document.beats.map((b) => b.background),
          doc.beats.map((b) => b.background),
        );
      }
    }
  } catch {
    throw new Error("STORY_CONTINUITY_FAILED");
  }
}
function preserve<T>(before: readonly T[], after: readonly T[]): void {
  const ids = new Set(after);
  if (before.some((id) => !ids.has(id))) throw new Error();
}
