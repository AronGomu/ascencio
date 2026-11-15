/** Versioned, explicit synonym reconciliation. Grouping never creates new findings. */
export interface ReasonVocabulary {
  version: string;
  aliases: Record<string, string>;
}
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
export function validateReasonVocabulary(vocabulary: ReasonVocabulary) {
  if (
    !vocabulary ||
    typeof vocabulary.version !== "string" ||
    !vocabulary.version.trim() ||
    !vocabulary.aliases ||
    Array.isArray(vocabulary.aliases)
  )
    throw Error("Reason vocabulary requires version and explicit aliases");
  for (const [from, to] of Object.entries(vocabulary.aliases))
    if (!validId(from) || !validId(to)) throw Error("Invalid reason alias ID");
  for (const id of Object.keys(vocabulary.aliases))
    canonicalReasonId(id, vocabulary);
  return vocabulary;
}
export function canonicalReasonId(id: string, vocabulary: ReasonVocabulary) {
  if (!validId(id)) throw Error("Invalid reason ID");
  const visited = new Set<string>();
  let current = id;
  while (Object.hasOwn(vocabulary.aliases, current)) {
    if (visited.has(current)) throw Error("Reason alias cycle");
    visited.add(current);
    const next = vocabulary.aliases[current];
    if (!validId(next)) throw Error("Invalid reason alias ID");
    current = next;
  }
  return current;
}
export interface ReasonOccurrence {
  id: string;
  loss: string;
  decision: string;
  reason: string;
  solution: string;
}
export interface ReconciledReason {
  id: string;
  vocabularyVersion: string;
  losses: string[];
  /** Original attribution and disagreements survive merging; no invented verdict. */
  occurrences: ReasonOccurrence[];
}
export function reconcileReasons(
  rows: ReasonOccurrence[],
  vocabulary: ReasonVocabulary,
): ReconciledReason[] {
  validateReasonVocabulary(vocabulary);
  const groups = new Map<string, ReconciledReason>();
  for (const row of rows) {
    if (!row.loss || !row.decision || !row.reason || !row.solution)
      throw Error("Reason occurrence requires supported loss and decision");
    const id = canonicalReasonId(row.id, vocabulary);
    const group = groups.get(id) ?? {
      id,
      vocabularyVersion: vocabulary.version,
      losses: [],
      occurrences: [],
    };
    if (!group.losses.includes(row.loss)) group.losses.push(row.loss);
    if (
      !group.occurrences.some(
        (previous) => JSON.stringify(previous) === JSON.stringify(row),
      )
    )
      group.occurrences.push({ ...row });
    groups.set(id, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, losses: group.losses.sort() }))
    .sort(
      (a, b) => b.losses.length - a.losses.length || a.id.localeCompare(b.id),
    );
}
