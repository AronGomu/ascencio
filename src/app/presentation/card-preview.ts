import type { CardCode } from "../../duel/contracts/ids.ts";

/** The subset of `__ACTIVE_CARD_TEXTS__` the preview panel reads. */
export interface CardPreviewText {
  readonly name: string;
  readonly description?: string;
}

export interface CardPreviewView {
  readonly code: CardCode;
  readonly name: string;
  readonly description: string;
}

/**
 * Resolves the panel's copy for one card code. A missing code means the card's
 * identity is hidden from the local viewer, so there is nothing to preview and
 * the caller must leave whatever the panel already shows untouched.
 */
export function cardPreviewForCode(
  code: CardCode | undefined,
  cardTexts: ReadonlyMap<number, CardPreviewText>,
): CardPreviewView | null {
  if (code === undefined) return null;
  const text = cardTexts.get(code);
  return {
    code,
    name: text?.name ?? `Card ${code}`,
    description: text?.description ?? "No card text available.",
  };
}
