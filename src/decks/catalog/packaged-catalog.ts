import {
  adaptAssetDeckCard,
  mapDeckBuilderCard,
  type AssetDeckCardRecord,
  type DeckBuilderCardView,
  type DeckCatalogRecord,
} from "./ocg-card-mapper.ts";

/** One row of the packaged text manifest: what a card is called and does. */
export interface PackagedCardText {
  readonly code: number;
  readonly name: string;
  readonly description: string;
}

/**
 * Joins the two halves a card needs to be editable — its masks and its copy —
 * into the records the deck editor validates and renders against.
 *
 * A card whose masks are packaged without its text is a broken build rather
 * than a card to show with a blank name, so it throws. Both manifests are cut
 * from the same code set at build time, which is what makes that unreachable
 * in a build that shipped.
 */
export function packagedCatalogRecords(
  cards: readonly AssetDeckCardRecord[],
  texts: readonly PackagedCardText[],
  imageUrlByCode?: ReadonlyMap<number, string>,
): readonly DeckCatalogRecord[] {
  const textByCode = new Map(texts.map((text) => [text.code, text] as const));
  return Object.freeze(
    cards.map((card) => {
      const text = textByCode.get(card.code);
      if (text === undefined)
        throw new Error(`Packaged card ${card.code} has no packaged text`);
      return adaptAssetDeckCard(
        card,
        { ...text, strings: [] },
        imageUrlByCode?.get(card.code) ?? null,
      );
    }),
  );
}

export function packagedCatalog(
  cards: readonly AssetDeckCardRecord[],
  texts: readonly PackagedCardText[],
  imageUrlByCode?: ReadonlyMap<number, string>,
): readonly DeckBuilderCardView[] {
  return Object.freeze(
    packagedCatalogRecords(cards, texts, imageUrlByCode).map(
      mapDeckBuilderCard,
    ),
  );
}
