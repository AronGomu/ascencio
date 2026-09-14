import type { CardImageLease } from "../../cards/images/index.ts";
import { cardsDeckCatalog } from "../../decks/catalog/index.ts";
import type { ShellGameplay } from "../core/installed-inputs.ts";
import type { PreparedRelease } from "./prepared-release.ts";

export async function selectedGameplay(
  prepared: PreparedRelease,
  signal: AbortSignal,
): Promise<ShellGameplay> {
  const runtime = await prepared.battle.load(signal);
  const chapters = prepared.story.chapters;
  const decks = [
    ...new Map(
      chapters
        .flatMap((chapter) => chapter.decks)
        .map((deck) => [deck.id, deck]),
    ).values(),
  ];
  const opponents = [
    ...new Map(
      chapters
        .flatMap((chapter) => chapter.opponents)
        .map((opponent) => [opponent.id, opponent]),
    ).values(),
  ];
  const sets = [
    ...new Map(
      chapters.flatMap((chapter) => chapter.sets).map((set) => [set.id, set]),
    ).values(),
  ];
  const defaults = chapters[0]!.defaults;
  const presentation = Object.freeze({
    snapshotId: runtime.snapshotId,
    catalogRevision: `${runtime.snapshotId}:${prepared.story.revision}`,
    cards: cardsDeckCatalog(prepared.cards),
    decks,
    opponents,
    defaults,
  });
  return Object.freeze({
    identity: `${runtime.snapshotId}:${prepared.story.revision}`,
    chapterIds: chapters.map((chapter) => chapter.id),
    presentation,
    cards: prepared.cards,
    sets,
    decks,
    opponents,
    defaults,
    battle: prepared.battle,
    editor: () => prepared.editor,
    async images(signal = new AbortController().signal) {
      const cardUrls = new Map<number, string>();
      const setUrls = new Map<string, string>();
      const leases: CardImageLease[] = [];
      const dispose = () => {
        for (const lease of leases.splice(0)) lease.release();
      };
      const results = await Promise.allSettled([
        ...prepared.cards.all().map(async (card) => {
          const lease = await prepared.images.acquire(
            card.code,
            "full",
            signal,
          );
          if (lease) {
            leases.push(lease);
            cardUrls.set(card.code, lease.url);
          }
        }),
        ...sets.map(async (set) => {
          const lease = await prepared.storyMedia.acquireSetImage(
            set.id,
            signal,
          );
          if (lease) {
            leases.push(lease);
            setUrls.set(set.id, lease.url);
          }
        }),
      ]);
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") {
        dispose();
        throw failure.reason;
      }
      return { cardUrls, setUrls, dispose };
    },
    cardImages: async () => prepared.images,
  });
}
