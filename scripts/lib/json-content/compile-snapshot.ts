import { createHash } from "node:crypto";
import { parseCriticalSnapshot } from "../../../src/storage/snapshot/parse-critical-snapshot.ts";

/** Recursive key ordering, UTF-8, no timestamps/newlines introduced by compilation. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const r = value as Record<string, unknown>;
    return `{${Object.keys(r)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(r[key])}`)
      .join(",")}}`;
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("JSON_VALUE_INVALID");
  return result;
}
export function compileSnapshot(value: unknown) {
  const snapshot = parseCriticalSnapshot(value);
  const sorted = {
    ...snapshot,
    cards: [...snapshot.cards]
      .sort((a, b) => a.definition.code - b.definition.code)
      .map((c) => ({
        ...c,
        texts: [...c.texts].sort((a, b) => compare(a.locale, b.locale)),
      })),
    scripts: [...snapshot.scripts].sort((a, b) => compare(a.name, b.name)),
    sets: [...snapshot.sets].sort((a, b) => compare(a.id, b.id)),
    decks: [...snapshot.decks].sort((a, b) => compare(a.id, b.id)),
    opponents: [...snapshot.opponents].sort((a, b) => compare(a.id, b.id)),
    limits: [...snapshot.limits].sort((a, b) => a[0] - b[0]),
    stories: [...snapshot.stories].sort((a, b) =>
      compare(a.contentId, b.contentId),
    ),
    media: [...snapshot.media].sort((a, b) => compare(a.id, b.id)),
  };
  const source = canonicalJson(sorted);
  const bytes = Buffer.byteLength(source);
  if (bytes > 256 * 1024 * 1024) throw new Error("SNAPSHOT_SIZE");
  return {
    snapshot: sorted,
    source,
    bytes,
    sha256: createHash("sha256").update(source).digest("hex"),
  };
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
