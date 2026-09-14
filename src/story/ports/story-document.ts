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
const choices = ["trust-rin", "challenge-rin", "observe-first"] as const;
function responses(value: unknown): Readonly<Record<StoryChoiceId, string>> {
  const r = record(value, choices);
  return {
    "trust-rin": text(r["trust-rin"]),
    "challenge-rin": text(r["challenge-rin"]),
    "observe-first": text(r["observe-first"]),
  };
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
      return { id: literal(c.id, ...choices), label: text(c.label) };
    },
    3,
  );
  unique(beats, (b) => b.id);
  unique(selected, (c) => c.id);
  if (!beats.length || selected.length !== 3) invalid();
  return freeze({
    schemaVersion: literal(r.schemaVersion, 1),
    contentId: literal(r.contentId, "prototype-prologue-v1"),
    title: text(r.title),
    beats,
    choices: selected,
    choiceResponses: responses(r.choiceResponses),
    laterAcknowledgments: responses(r.laterAcknowledgments),
  });
}
