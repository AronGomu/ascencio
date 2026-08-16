import { isProjectedCardIdentityKnown } from "../../duel/card-visibility.ts";
import type { CardCode } from "../../duel/contracts/ids.ts";
import type { PublicCard } from "../../duel/contracts/public-duel-state.ts";
import type { CardPreviewView } from "../../../shell/index.ts";

/** The subset of `__ACTIVE_CARD_TEXTS__` the preview panel reads. */
export interface CardPreviewText {
  readonly name: string;
  readonly description?: string;
}

/* The panel itself lives in the shell, shared with the deck editor, so its view
   shape is the shell's. Re-exported here because the duel's own modules read it
   as duel presentation vocabulary. */
export type { CardPreviewView };

/** Shown when a face-down/hidden board card is hovered: no code to lease. */
export const HIDDEN_CARD_PREVIEW: CardPreviewView = Object.freeze({
  code: 0,
  name: "Face-down card",
  description: "No information is available for this card.",
});

/** The code of the last public card in a stack, or `undefined` when nothing in it is public. */
export function stackTopCode(stack: {
  readonly topCardCode?: CardCode;
}): CardCode | undefined {
  return stack.topCardCode;
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

/** The card fields identity visibility is decided from. */
export type PreviewablePublicCard = Pick<
  PublicCard,
  "code" | "controller" | "location" | "position"
>;

/** Projected code is the projector-attested local-viewer capability. */
export function cardPreviewForPublicCard(
  card: PreviewablePublicCard,
  cardTexts: ReadonlyMap<number, CardPreviewText>,
): CardPreviewView | null {
  if (!isProjectedCardIdentityKnown(card)) return null;
  return cardPreviewForCode(card.code, cardTexts);
}
