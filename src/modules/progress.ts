/** Cross-module story outcomes live in the campaign save, never installed content. */
export type FactValue = string | number | boolean | null;
export interface CampaignProgress {
  readonly schemaVersion: 1;
  readonly completedChapterIds: readonly string[];
  readonly facts: Readonly<Record<string, FactValue>>;
}
export type ProgressRequirement =
  | { readonly kind: "chapter-completed"; readonly chapterId: string }
  | { readonly kind: "fact"; readonly id: string; readonly equals: FactValue };

export function stableReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !value.includes("\0")
  );
}
export function factValue(value: unknown): value is FactValue {
  return (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.length <= 4096) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}
export function validFacts(value: unknown): value is CampaignProgress["facts"] {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length <= 10000 &&
    Object.entries(value).every(
      ([id, value]) =>
        stableReference(id) && id.includes(":") && factValue(value),
    )
  );
}
export function validRequirements(
  value: unknown,
): value is readonly ProgressRequirement[] {
  if (!Array.isArray(value) || value.length > 1000) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return false;
    const keys = Object.keys(item).sort().join();
    return item.kind === "chapter-completed"
      ? keys === "chapterId,kind" && stableReference(item.chapterId)
      : item.kind === "fact" &&
          keys === "equals,id,kind" &&
          stableReference(item.id) &&
          item.id.includes(":") &&
          factValue(item.equals);
  });
}
export function progressSatisfied(
  progress: CampaignProgress,
  requirements: readonly ProgressRequirement[],
): boolean {
  return requirements.every((requirement) =>
    requirement.kind === "chapter-completed"
      ? progress.completedChapterIds.includes(requirement.chapterId)
      : Object.hasOwn(progress.facts, requirement.id) &&
        progress.facts[requirement.id] === requirement.equals,
  );
}
export function readFact(
  progress: CampaignProgress,
  id: string,
  fallback: FactValue,
): FactValue {
  return Object.hasOwn(progress.facts, id) ? progress.facts[id]! : fallback;
}
