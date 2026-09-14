import type { InstalledGameplay } from "../../content/index.ts";
import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
import type { PinnedDeckRuleset } from "../../decks/catalog/pinned-ruleset.ts";
import { deckId, resolveDeck, type DeckRepository } from "../../decks/index.ts";
import type { SelectableDeck } from "./selectable-decks.ts";

export async function installedSelectableDecks(
  gameplay: InstalledGameplay,
  repository: Pick<DeckRepository, "list" | "load">,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  ruleset: PinnedDeckRuleset,
): Promise<readonly SelectableDeck[]> {
  const chapterDecks = gameplay.decks.map((deck) =>
    Object.freeze({
      key: `chapter:${deck.id}`,
      label: deck.name,
      source: "chapter" as const,
      selection: Object.freeze({
        kind: "local" as const,
        deck: Object.freeze({
          ref: Object.freeze({
            type: "local" as const,
            deckId: deckId(`chapter:${deck.id}`),
            revision: 0,
          }),
          name: deck.name,
          validationDigest: `${gameplay.content.catalogSha256}:${deck.id}`,
          main: Object.freeze([...deck.main]),
          extra: Object.freeze([...deck.extra]),
          side: Object.freeze([...deck.side]),
        }),
      }),
      blockReason: null,
      lists: Object.freeze({
        main: Object.freeze([...deck.main]),
        extra: Object.freeze([...deck.extra]),
        side: Object.freeze([...deck.side]),
      }),
      updatedAt: null,
    }),
  );
  const localDecks: SelectableDeck[] = [];
  for (const record of await repository.list()) {
    const resolved = await resolveDeck(record.id, repository, catalog, ruleset);
    if (resolved.type === "missing") continue;
    localDecks.push(
      Object.freeze({
        key: `local:${record.id}:${record.revision}`,
        label: record.name,
        source: "local" as const,
        selection:
          resolved.type === "ready"
            ? Object.freeze({ kind: "local" as const, deck: resolved.deck })
            : null,
        blockReason:
          resolved.type === "ready"
            ? null
            : (resolved.issues[0]?.message ?? "Deck is not legal."),
        lists: Object.freeze({
          main: Object.freeze([...record.main]),
          extra: Object.freeze([...record.extra]),
          side: Object.freeze([...record.side]),
        }),
        updatedAt: record.updatedAt,
      }),
    );
  }
  return Object.freeze([...chapterDecks, ...localDecks]);
}
