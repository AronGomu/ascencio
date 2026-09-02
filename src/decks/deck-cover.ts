import type { DeckBuilderCardView } from "./catalog/ocg-card-mapper.ts";
import type { DeckCardLists } from "./deck-contracts.ts";

export interface DeckCoverSource extends DeckCardLists {
  readonly illustrationCardCode: number | null;
}

/** Explicit illustration while it remains in deck; automatic headline otherwise. */
export function deckCoverCardCode(deck: DeckCoverSource): number | null {
  const codes = [...deck.main, ...deck.extra, ...deck.side];
  if (
    deck.illustrationCardCode !== null &&
    codes.includes(deck.illustrationCardCode)
  )
    return deck.illustrationCardCode;
  return deck.extra[0] ?? deck.main[0] ?? null;
}

/** Runtime full-card URL → separately archived YGOPRODeck art crop URL. */
export function croppedCardImageUrl(imageUrl: string | null): string | null {
  if (imageUrl === null) return null;
  const marker = "/runtime/images/";
  const index = imageUrl.lastIndexOf(marker);
  return index < 0
    ? imageUrl
    : `${imageUrl.slice(0, index)}/runtime/images-cropped/${imageUrl.slice(index + marker.length)}`;
}

export function deckCoverImageUrl(
  deck: DeckCoverSource,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
): string | null {
  const code = deckCoverCardCode(deck);
  return code === null
    ? null
    : croppedCardImageUrl(catalog.get(code)?.imageUrl ?? null);
}
