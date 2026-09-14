import { cardCode } from "../../cards/index.ts";
import type { StoryRelease, StorySet } from "./story-release.ts";
import { parseStoryDocument } from "./story-document.ts";
import {
  array,
  freeze,
  integer,
  invalid,
  literal,
  record,
  semanticJson,
  text,
  unique,
} from "./release-value.ts";
function code(value: unknown) {
  return cardCode(integer(value, 1));
}
function set(value: unknown): StorySet {
  const r = record(value, ["id", "name", "releaseYear", "cards"]);
  const cards = array(r.cards, (value) => {
    const c = record(value, [
      "code",
      "name",
      "rarity",
      "printingCode",
      "sourceRarity",
      "sourceRarityCode",
    ]);
    return {
      code: code(c.code),
      name: text(c.name),
      rarity: literal(
        c.rarity,
        "common",
        "rare",
        "super-rare",
        "ultra-rare",
        "secret-rare",
        "ultimate-rare",
        "ghost-rare",
      ),
      printingCode: text(c.printingCode),
      sourceRarity: text(c.sourceRarity),
      sourceRarityCode: text(c.sourceRarityCode, 64, true),
    };
  });
  unique(
    cards,
    (c) =>
      `${c.code}:${c.printingCode}:${c.sourceRarity}:${c.sourceRarityCode}`,
  );
  if (cards.length === 0) invalid();
  return {
    id: text(r.id),
    name: text(r.name),
    releaseYear: integer(r.releaseYear, 1, 9999),
    cards,
  };
}
function chapter(value: unknown): StoryRelease["chapters"][number] {
  const r = record(value, [
    "id",
    "document",
    "cardCodes",
    "sets",
    "decks",
    "opponents",
    "defaults",
  ]);
  const cardCodes = array(r.cardCodes, code);
  unique(cardCodes, (c) => c);
  const sets = array(r.sets, set);
  unique(sets, (s) => s.id);
  const decks = array(r.decks, (value) => {
    const d = record(value, ["id", "name", "main", "extra", "side"]);
    return {
      id: text(d.id),
      name: text(d.name),
      main: array(d.main, code, 60),
      extra: array(d.extra, code, 15),
      side: array(d.side, code, 15),
    };
  });
  unique(decks, (d) => d.id);
  if (decks.some((deck) => deck.main.length < 40)) invalid();
  const opponents = array(r.opponents, (value) => {
    const o = record(value, ["id", "name", "line", "deckId", "policyId"]);
    return {
      id: text(o.id),
      name: text(o.name),
      line: text(o.line),
      deckId: text(o.deckId),
      policyId: literal(o.policyId, "basic"),
    };
  });
  unique(opponents, (o) => o.id);
  const d = record(r.defaults, ["starterDeckId", "opponentId"]);
  return {
    id: text(r.id),
    document: r.document === null ? null : parseStoryDocument(r.document),
    cardCodes,
    sets,
    decks,
    opponents,
    defaults: {
      starterDeckId: text(d.starterDeckId),
      opponentId: text(d.opponentId),
    },
  };
}
export function parseStoryRelease(value: unknown): StoryRelease {
  try {
    const r = record(value, ["revision", "chapters"]);
    const chapters = [...array(r.chapters, chapter, 99)].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    unique(chapters, (c) => c.id);
    if (chapters.length === 0) invalid();
    const release = { revision: integer(r.revision, 1), chapters };
    const cards = new Set(chapters.flatMap((c) => c.cardCodes));
    const sets = definitions(chapters.flatMap((c) => c.sets));
    const decks = definitions(chapters.flatMap((c) => c.decks));
    const opponents = definitions(chapters.flatMap((c) => c.opponents));
    for (const s of sets.values())
      if (s.cards.some((c) => !cards.has(c.code))) invalid();
    for (const d of decks.values())
      if (
        [...d.main, ...d.extra, ...d.side].some(
          (c) => !cards.has(c as ReturnType<typeof code>),
        )
      )
        invalid();
    for (const o of opponents.values()) if (!decks.has(o.deckId)) invalid();
    for (const c of chapters)
      if (
        !decks.has(c.defaults.starterDeckId) ||
        !opponents.has(c.defaults.opponentId)
      )
        invalid();
    return freeze(release);
  } catch {
    return invalid();
  }
}
function definitions<T extends { readonly id: string }>(
  items: readonly T[],
): Map<string, T> {
  const found = new Map<string, T>();
  for (const item of items) {
    const previous = found.get(item.id);
    if (previous && semanticJson(previous) !== semanticJson(item)) invalid();
    found.set(item.id, item);
  }
  return found;
}
export function validateStoryRelease(release: StoryRelease): void {
  parseStoryRelease(release);
}
