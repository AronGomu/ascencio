import type { ChapterGameplay } from "./contracts/chapter-gameplay.ts";
import type { ContentReadPort } from "./contracts/content-read-port.ts";
import type { ContentResult } from "./contracts/content-result.ts";
import type { ContentSetRef } from "./contracts/content-set-ref.ts";
import type { InstalledGameplay } from "./contracts/installed-gameplay.ts";
import {
  contentError,
  failure,
  json,
  same,
  unwrap,
} from "./content-verification.ts";
import { inspectInstalledContent } from "./installed-content-inspection.ts";
import { installedContentState } from "./installed-content-state.ts";
import { manifestClosure } from "./install/manifest-closure.ts";
import { parseChapterGameplay } from "./parsers/chapter-gameplay.ts";
import { compare } from "./parsers/schema.ts";

function chapterNumber(id: string): number {
  return Number(id.slice("chapter-".length));
}

function addDefinition<T>(
  definitions: Map<string | number, T>,
  key: string | number,
  value: T,
): void {
  const prior = definitions.get(key);
  if (prior !== undefined && !same(prior, value))
    throw failure("CONTENT_INCOMPATIBLE");
  definitions.set(key, value);
}

export async function loadInstalledGameplay(
  reader: ContentReadPort,
  ref: ContentSetRef,
): Promise<ContentResult<InstalledGameplay>> {
  if (!Array.isArray(ref?.chapters) || ref.chapters.length === 0)
    return failure("CONTENT_MISSING");
  try {
    const state = installedContentState(reader);
    const revision = state.revision;
    const inspected = unwrap(await inspectInstalledContent(reader, ref));
    const entries = await manifestClosure(
      [ref.runtime, ...ref.chapters],
      async (manifestRef) =>
        unwrap(await reader.readManifest(manifestRef)).value,
    );
    if (entries.length !== ref.chapters.length + 1)
      throw failure("CONTENT_INCOMPATIBLE");
    const byPack = new Map(entries.map((entry) => [entry.ref.packId, entry]));
    const chapters = [...ref.chapters].sort(
      (left, right) => chapterNumber(left.packId) - chapterNumber(right.packId),
    );
    const games: ChapterGameplay[] = [];
    for (const chapter of chapters) {
      const entry = byPack.get(chapter.packId);
      if (
        !entry ||
        !same(entry.ref, chapter) ||
        entry.manifest.gameplayPath === null
      )
        throw failure("CONTENT_INCOMPATIBLE");
      const declared = entry.manifest.files.find(
        (file) => file.path === entry.manifest.gameplayPath,
      );
      if (!declared || declared.mediaType !== "application/json")
        throw failure("CONTENT_INVALID_MANIFEST");
      const blob = unwrap(
        await reader.readFile(entry.ref, entry.manifest.gameplayPath),
      );
      if (blob.size !== declared.bytes)
        throw failure("CONTENT_INTEGRITY_FAILED");
      const game = unwrap(
        parseChapterGameplay(json(new Uint8Array(await blob.arrayBuffer()))),
      );
      if (
        game.chapterId !== chapter.packId ||
        !same(
          entry.manifest.cardCodes,
          game.cards.map(({ code }) => code),
        ) ||
        !same(
          entry.manifest.opponentIds,
          game.opponents.map(({ id }) => id),
        ) ||
        entry.manifest.storyContentId !== (game.story?.contentId ?? null)
      )
        throw failure("CONTENT_INCOMPATIBLE");
      games.push(game);
    }

    const cards = new Map<number, InstalledGameplay["cards"][number]>();
    const sets = new Map<string, InstalledGameplay["sets"][number]>();
    const decks = new Map<string, InstalledGameplay["decks"][number]>();
    const opponents = new Map<string, InstalledGameplay["opponents"][number]>();
    for (const game of games) {
      for (const card of game.cards) addDefinition(cards, card.code, card);
      for (const set of game.sets) addDefinition(sets, set.id, set);
      for (const deck of game.decks) addDefinition(decks, deck.id, deck);
      for (const opponent of game.opponents)
        addDefinition(opponents, opponent.id, opponent);
    }
    if (state.revision !== revision) throw failure("CONTENT_MISSING");
    return {
      kind: "ok",
      value: Object.freeze({
        content: inspected,
        chapterIds: Object.freeze(games.map(({ chapterId }) => chapterId)),
        cards: Object.freeze(
          [...cards.values()].sort((a, b) => a.code - b.code),
        ),
        sets: Object.freeze(
          [...sets.values()].sort((a, b) => compare(a.id, b.id)),
        ),
        decks: Object.freeze(
          [...decks.values()].sort((a, b) => compare(a.id, b.id)),
        ),
        opponents: Object.freeze(
          [...opponents.values()].sort((a, b) => compare(a.id, b.id)),
        ),
        defaults: games[0]!.defaults,
      }),
    };
  } catch (error) {
    return contentError(error);
  }
}
