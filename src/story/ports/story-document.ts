import type { StoryChoiceId, StoryDocument } from "./story-release.ts";
import {
  array,
  freeze,
  invalid,
  literal,
  record,
  text,
  unique,
} from "./release-value.ts";
function responses(
  value: unknown,
  ids: readonly string[],
): Readonly<Record<StoryChoiceId, string>> {
  const r = record(value, ids);
  return Object.fromEntries(ids.map((id) => [id, text(r[id])]));
}
export function parseStoryDocument(value: unknown): StoryDocument {
  const r = record(value, [
    "schemaVersion",
    "contentId",
    "title",
    "beats",
    "choices",
    "choiceResponses",
    "laterAcknowledgments",
  ]);
  const beats = array(r.beats, (value) => {
    const b = record(value, [
      "id",
      "speaker",
      "kind",
      "text",
      "background",
      "characters",
    ]);
    const characters = array(
      b.characters,
      (v) => literal(v, "rin-neutral", "rin-smile", "kael"),
      3,
    );
    unique(characters, (v) => v);
    return {
      id: text(b.id),
      speaker: literal(b.speaker, "Rin", "Kael", "Protagonist", null),
      kind: literal(b.kind, "dialogue", "narration", "thought"),
      text: text(b.text),
      background: literal(b.background, "station", "concourse", "arena"),
      characters,
    };
  });
  const selected = array(
    r.choices,
    (value) => {
      const c = record(value, ["id", "label"]);
      return { id: text(c.id, 256), label: text(c.label) };
    },
    32,
  );
  unique(beats, (b) => b.id);
  unique(selected, (c) => c.id);
  if (!beats.length) invalid();
  return freeze({
    schemaVersion: literal(r.schemaVersion, 1),
    contentId: text(r.contentId, 256),
    title: text(r.title),
    beats,
    choices: selected,
    choiceResponses: responses(
      r.choiceResponses,
      selected.map(({ id }) => id),
    ),
    laterAcknowledgments: responses(
      r.laterAcknowledgments,
      selected.map(({ id }) => id),
    ),
  });
}
