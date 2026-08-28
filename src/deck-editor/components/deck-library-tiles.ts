import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
import type {
  DeckId,
  DeckRecord,
  DeckValidationSummary,
} from "../../decks/deck-contracts.ts";
import type { DeckTileModel } from "../../deck-select/index.ts";

/** Which decks the scope has singled out. Neither is a property of the stored
    record — the controller reads them from their own preference rows — so the
    host hands them over rather than the mapping digging for them. */
export interface DeckLibraryMarks {
  readonly defaultDeckId: DeckId | null;
  readonly favouriteDeckIds: readonly DeckId[];
}

/** Why the deck cannot be fielded, named after the limit that binds. A deck
    whose cards the save no longer owns is repaired in the shop; one that
    breaks a build rule is repaired in the editor, and "Illegal" on its own
    would send a player who never touched the deck looking for a mistake they
    did not make (ADR-050).

    Ownership is claimed only when it is the whole story. A deck that is both
    short of cards and short of a build rule is not fixed by buying the card
    back, so promising that in a badge would buy the player a wasted trip. */
function illegalLabel(validation: DeckValidationSummary): string {
  const errors = validation.issues.filter(
    ({ severity }) => severity === "error",
  );
  return errors.every(({ code }) => code === "not-owned")
    ? "Cards not owned"
    : "Illegal";
}

/** The deck the tile's art is drawn from: the Extra Deck's first card when the
    deck has one, because that is the deck's own headline, and the first Main
    Deck card otherwise. */
function coverImageUrl(
  deck: DeckRecord,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
): string | null {
  const code = deck.extra[0] ?? deck.main[0] ?? null;
  return code === null ? null : (catalog.get(code)?.imageUrl ?? null);
}

/** Every stored deck as the shared grid renders it. Ordering is the screen's
    own job, so the tiles come back in the order they were handed over. */
export function deckLibraryTiles(
  decks: readonly DeckRecord[],
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  marks: DeckLibraryMarks,
): readonly DeckTileModel[] {
  const favourites = new Set(marks.favouriteDeckIds);
  return Object.freeze(
    decks.map((deck) => {
      const legal = deck.validation.status !== "errors";
      const blockReason = legal ? null : illegalLabel(deck.validation);
      return Object.freeze({
        key: deck.id,
        name: deck.name,
        counts: Object.freeze({
          main: deck.main.length,
          extra: deck.extra.length,
          side: deck.side.length,
        }),
        /* The meta line answers one question, and for a deck that cannot be
           fielded the answer is why rather than when it was last saved. */
        meta:
          blockReason ?? `Updated ${new Date(deck.updatedAt).toLocaleString()}`,
        coverImageUrl: coverImageUrl(deck, catalog),
        legal,
        blockReason,
        /* Every deck in this library was built in this library: none ships
           with the app, none belongs to an AI, and all of them can go. */
        bundled: false,
        lockedBy: null,
        favourite: favourites.has(deck.id),
        isDefault: deck.id === marks.defaultDeckId,
        deletable: true,
        updatedAt: deck.updatedAt,
      });
    }),
  );
}
