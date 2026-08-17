import { isProjectedCardIdentityKnown } from "../../duel/card-visibility.ts";
import type { CardCode } from "../../duel/contracts/ids.ts";
import type { PublicCard } from "../../duel/contracts/public-duel-state.ts";

/** The subset of `__ACTIVE_CARD_TEXTS__` the preview panel reads. */
export interface CardPreviewText {
  readonly name: string;
  readonly description?: string;
  readonly family?: "monster" | "spell" | "trap";
  readonly subtypes?: readonly string[];
  readonly attribute?: string | null;
  readonly race?: string | null;
  readonly levelRankLink?: number | null;
  readonly ratingLabel?: "Level" | "Rank" | "Link" | null;
  readonly attack?: number | null;
  readonly defense?: number | null;
}

export interface CardPreviewView {
  readonly code: CardCode;
  readonly name: string;
  readonly description: string;
  readonly statsLine: string | null;
}

/** Shown when a face-down/hidden board card is hovered: no code to lease. */
export const HIDDEN_CARD_PREVIEW: CardPreviewView = Object.freeze({
  code: 0 as CardCode,
  name: "Face-down card",
  description: "No information is available for this card.",
  statsLine: null,
});

/** Builds the compact stats line shown in the preview panel below the card name. */
export function formatCardStatsLine(text: CardPreviewText): string | null {
  if (text.family === "monster") {
    const parts: string[] = [];
    if (text.attribute) parts.push(text.attribute);
    if (text.race) parts.push(text.race);
    if (text.ratingLabel != null && text.levelRankLink != null)
      parts.push(`${text.ratingLabel} ${text.levelRankLink}`);
    const atk =
      text.attack == null || text.attack < 0 ? "?" : String(text.attack);
    if (text.ratingLabel === "Link") {
      parts.push(`ATK ${atk}`);
    } else {
      const def =
        text.defense == null || text.defense < 0 ? "?" : String(text.defense);
      parts.push(`ATK ${atk} / DEF ${def}`);
    }
    return parts.join(" \u00b7 ");
  }
  if (text.family === "spell" || text.family === "trap") {
    const family = text.family === "spell" ? "Spell" : "Trap";
    const subtype = text.subtypes?.[0];
    return subtype ? `${family} \u00b7 ${subtype}` : family;
  }
  return null;
}

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
    statsLine: text != null ? formatCardStatsLine(text) : null,
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
