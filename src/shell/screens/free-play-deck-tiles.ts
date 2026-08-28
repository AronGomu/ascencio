import type { SelectableDeck } from "../../battle/index.ts";
import type { DeckTileModel } from "../../deck-select/index.ts";
import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";

/** What free play knows about its decks beyond the decks themselves: the art
    a cover is drawn from, the stars kept in two places, and which AI owns
    which bundled deck. */
export interface FreePlayDeckTileContext {
  readonly catalog: ReadonlyMap<number, DeckBuilderCardView>;
  /** Local favourites, as the deck ids `DeckRepository.listFavourites` returns. */
  readonly favouriteDeckIds: readonly string[];
  /** Bundled favourites, as the full `preset:` keys the shell settings hold —
      `DeckRepository.setFavourite` only covers decks the player built. */
  readonly presetFavouriteIds: readonly string[];
  /** The repository's default deck id, or `null` when none is set. */
  readonly defaultDeckId: string | null;
  /** Deck key → the AI persona that owns it, from `FREE_PLAY_OPPONENTS`. */
  readonly aiOwnerByDeckKey: ReadonlyMap<string, string>;
}

/**
 * One free-play deck as the shared selection screen renders it.
 *
 * Every deck the listing offers is playable — `listSelectableDecks` drops the
 * ones the pinned ruleset or the card snapshot refuses — so a tile from here
 * is always legal and never carries a block reason. The screen still has both
 * fields because the deck library will show refused decks with the reason;
 * free play simply never sees one.
 */
export function freePlayDeckTile(
  deck: SelectableDeck,
  context: FreePlayDeckTileContext,
): DeckTileModel {
  /* The deck id rather than the key's middle segment: a key carries the
     revision as well, and an id is only forbidden to contain `\0`, so parsing
     one back out of the key would be a guess where the selection is a fact. */
  const localId =
    deck.selection.kind === "local" ? deck.selection.deck.ref.deckId : null;
  /* The Extra Deck's first card is the deck's face — it names the strategy in
     a way the first Main Deck card rarely does — and derived per listing, so a
     deck edited into another theme never keeps yesterday's cover. */
  const cover = deck.lists.extra[0] ?? deck.lists.main[0] ?? null;
  return {
    key: deck.key,
    name: deck.label,
    counts: {
      main: deck.lists.main.length,
      extra: deck.lists.extra.length,
      side: deck.lists.side.length,
    },
    /* A bundled deck is the only one with no stamp: it is compiled into this
       build and was never saved at all. */
    meta:
      deck.updatedAt === null
        ? "Bundled"
        : `Updated ${new Date(deck.updatedAt).toLocaleDateString()}`,
    coverImageUrl:
      cover === null ? null : (context.catalog.get(cover)?.imageUrl ?? null),
    legal: true,
    blockReason: null,
    bundled: deck.source === "preset",
    lockedBy: context.aiOwnerByDeckKey.get(deck.key) ?? null,
    favourite:
      localId === null
        ? context.presetFavouriteIds.includes(deck.key)
        : context.favouriteDeckIds.includes(localId),
    isDefault: localId !== null && localId === context.defaultDeckId,
    deletable: deck.source === "local",
    updatedAt: deck.updatedAt,
  };
}
