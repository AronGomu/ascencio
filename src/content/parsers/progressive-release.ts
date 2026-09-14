import type {
  ChapterId,
  ProgressiveManifest,
} from "../contracts/progressive-release.ts";
import { parseProgressiveFile, progressivePath } from "./progressive-file.ts";
import {
  array,
  budget,
  chapterId,
  compare,
  hash,
  integer,
  invalid,
  literal,
  record,
  sorted,
} from "./schema.ts";

/** Pure shape validation. Callers must bound/verify original bytes before JSON decoding. */
export function parseProgressiveManifest(value: unknown): ProgressiveManifest {
  budget(value, 32 * 1024 * 1024);
  const v = record(value, [
    "schemaVersion",
    "releaseSequence",
    "coreRange",
    "runtimeSnapshotId",
    "chapters",
    "files",
  ]);
  const range = record(v.coreRange, ["min", "maxExclusive"]);
  const manifest: ProgressiveManifest = {
    schemaVersion: literal(v.schemaVersion, 3),
    releaseSequence: integer(v.releaseSequence, Number.MAX_SAFE_INTEGER, 1),
    coreRange: {
      min: integer(range.min, Number.MAX_SAFE_INTEGER, 1),
      maxExclusive: integer(range.maxExclusive, Number.MAX_SAFE_INTEGER, 1),
    },
    runtimeSnapshotId: hash(v.runtimeSnapshotId),
    chapters: array(
      v.chapters,
      (value) => {
        const c = record(value, [
          "id",
          "title",
          "description",
          "depends",
          "gameplayPath",
          "storyPath",
        ]);
        if (typeof c.title !== "string" || typeof c.description !== "string")
          invalid();
        const depends = array(c.depends, chapterId, 99);
        sorted(depends, compare);
        return {
          id: chapterId(c.id),
          title: c.title,
          description: c.description,
          depends,
          gameplayPath: progressivePath(c.gameplayPath),
          storyPath: c.storyPath === null ? null : progressivePath(c.storyPath),
        };
      },
      99,
    ),
    files: array(v.files, parseProgressiveFile, 50000),
  };
  if (
    manifest.coreRange.maxExclusive <= manifest.coreRange.min ||
    manifest.chapters.length === 0
  )
    invalid();
  sorted(manifest.chapters, (a, b) => compare(a.id, b.id));
  sorted(manifest.files, (a, b) => compare(a.path, b.path));
  const chapters = new Map(
    manifest.chapters.map((chapter) => [chapter.id, chapter]),
  );
  const visited = new Set<ChapterId>();
  const visiting = new Set<ChapterId>();
  const visit = (id: ChapterId): void => {
    if (visiting.has(id)) invalid();
    if (visited.has(id)) return;
    const chapter = chapters.get(id);
    if (!chapter) invalid();
    visiting.add(id);
    const closure = new Set(chapter.depends);
    for (const dependency of chapter.depends) {
      visit(dependency);
      if (chapters.get(dependency)!.depends.some((id) => !closure.has(id)))
        invalid();
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const chapter of manifest.chapters) visit(chapter.id);
  let total = 0;
  for (const file of manifest.files) {
    total = integer(total + file.bytes);
    if (file.packIds.some((id) => id !== "runtime" && !chapters.has(id)))
      invalid();
  }
  // Runtime is implicit in every playable chapter closure, never a ChapterId edge.
  if (!manifest.files.some((file) => file.role === "runtime")) invalid();
  const files = new Map(manifest.files.map((file) => [file.path, file]));
  for (const chapter of manifest.chapters) {
    for (const [path, role] of [
      [chapter.gameplayPath, "gameplay"],
      [chapter.storyPath, "story"],
    ] as const) {
      if (path === null) continue;
      const file = files.get(path);
      if (
        !file ||
        !file.required ||
        file.role !== role ||
        !file.packIds.includes(chapter.id)
      )
        invalid();
    }
  }
  return manifest;
}
