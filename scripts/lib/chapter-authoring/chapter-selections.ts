import type { AuthoringResult } from "./authoring-result.ts";
import {
  array,
  hash,
  integer,
  invalid,
  literal,
  record,
  result,
  text,
  unique,
} from "./schema.ts";

export interface ChapterSelection {
  readonly id: `chapter-${string}`;
  readonly title: string;
  readonly published: boolean;
  readonly setNames: readonly string[];
  readonly additionalCardCodes: readonly number[];
  readonly opponentIds: readonly string[];
  readonly storyContentId: "prototype-prologue-v1" | null;
}

export interface ChapterSelections {
  readonly schemaVersion: 1;
  readonly sourceSha256: string;
  readonly chapters: readonly ChapterSelection[];
}

export function parseChapterSelections(
  value: unknown,
): AuthoringResult<ChapterSelections> {
  return result(value, 1048576, (value) => {
    const v = record(value, ["schemaVersion", "sourceSha256", "chapters"]);
    const chapters = array(
      v.chapters,
      (value) => {
        const c = record(value, [
          "id",
          "title",
          "published",
          "setNames",
          "additionalCardCodes",
          "opponentIds",
          "storyContentId",
        ]);
        const setNames = array(c.setNames, text, 2048);
        const additionalCardCodes = array(c.additionalCardCodes, (v) =>
          integer(v, 0xffffffff, 1),
        );
        const opponentIds = array(c.opponentIds, text);
        unique(setNames, (v) => v);
        unique(additionalCardCodes, (v) => v);
        unique(opponentIds, (v) => v);
        return {
          id: literal(c.id, "chapter-01"),
          title: text(c.title),
          published: literal(c.published, true, false),
          setNames,
          additionalCardCodes,
          opponentIds,
          storyContentId: literal(
            c.storyContentId,
            "prototype-prologue-v1",
            null,
          ),
        };
      },
      1,
    );
    if (chapters.length !== 1) invalid();
    return {
      schemaVersion: literal(v.schemaVersion, 1),
      sourceSha256: hash(v.sourceSha256),
      chapters,
    };
  });
}
