import type { BattlePresentationInput } from "../ports/index.ts";
import type { DeckBuilderCardView } from "../../decks/catalog/index.ts";
import type { PinnedDeckRuleset } from "../../decks/validation/index.ts";
import { deckId, resolveDeck, type DeckRepository } from "../../decks/index.ts";
import type { SelectableDeck } from "./selectable-decks.ts";

export async function installedSelectableDecks(
  gameplay: BattlePresentationInput,
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
          validationDigest: `${gameplay.catalogRevision}:${deck.id}`,
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
    const ready = resolved.type === "ready" ? resolved.deck : null;
    localDecks.push(
      Object.freeze({
        key: `local:${ready?.ref.deckId ?? record.id}:${ready?.ref.revision ?? record.revision}`,
        label: ready?.name ?? record.name,
        source: "local" as const,
        selection:
          ready === null
            ? null
            : Object.freeze({ kind: "local" as const, deck: ready }),
        blockReason:
          resolved.type === "ready"
            ? null
            : (resolved.issues[0]?.message ?? "Deck is not legal."),
        lists: Object.freeze({
          main: ready?.main ?? Object.freeze([...record.main]),
          extra: ready?.extra ?? Object.freeze([...record.extra]),
          side: ready?.side ?? Object.freeze([...record.side]),
        }),
        updatedAt: record.updatedAt,
      }),
    );
  }
  return Object.freeze([...chapterDecks, ...localDecks]);
}
