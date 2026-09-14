import {
  cardCode,
  createCards,
  type CardCode,
  type CardImageVariant,
} from "../../cards/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type { InstalledGameplay } from "../../content/index.ts";
import type { EditorCatalogInput } from "../../deck-editor/ports/index.ts";
import { cloneCardLists } from "../../decks/contracts/index.ts";

// Transitional required-only adapter: optional media is not read or downloaded.
const unavailableImages: CardImageSource = Object.freeze({
  acquire: async (
    _code: CardCode,
    _variant: CardImageVariant,
    signal: AbortSignal,
  ) => {
    if (signal.aborted)
      throw new DOMException("The operation was aborted.", "AbortError");
    return null;
  },
});

export function installedEditorCatalog(
  gameplay: InstalledGameplay,
  images: CardImageSource = unavailableImages,
): EditorCatalogInput {
  const starter = gameplay.decks.find(
    ({ id }) => id === gameplay.defaults.starterDeckId,
  );
  if (starter === undefined) throw new Error("DECK_RELEASE_INVALID");
  return Object.freeze({
    cards: createCards(
      gameplay.cards.map(({ record, text }) => {
        const code = cardCode(record.code);
        if (text.code !== code) throw new Error("CARDS_INVALID_DEFINITION");
        return {
          ...record,
          code,
          scope: record.ot,
          name: text.name,
          description: text.description,
          strings: text.strings,
          images: {
            full: { code, variant: "full" },
            cropped: { code, variant: "cropped" },
          },
        };
      }),
    ),
    images,
    starter: Object.freeze({
      name: starter.name,
      cards: cloneCardLists(starter),
    }),
  });
}
