import { isDeckId, type DeckId } from "../presets/deck-catalog.ts";
import {
  DuelCommandValidationError,
  requireOnlyKeys,
  requireRecord,
} from "./duel-command-parsing.ts";

/** Which deck a seat brings into the Worker: a bundled preset the Worker loads
    itself, or the explicit card codes the caller wants played. The `cards`
    arm is how a deck the player built reaches the engine without the Worker
    trusting anything the main thread claims about it. */
export type DuelDeckSelection =
  | { readonly kind: "preset"; readonly deckId: DeckId }
  | {
      readonly kind: "cards";
      readonly main: readonly number[];
      readonly extra: readonly number[];
      readonly side: readonly number[];
    };

const MINIMUM_MAIN = 40;
const MAXIMUM_MAIN = 60;
const MAXIMUM_EXTRA = 15;
const MAXIMUM_SIDE = 15;
const MAXIMUM_COPIES = 3;

/**
 * Parses one seat's deck selection off an untrusted Worker message.
 *
 * Every bound below is a refusal, never a repair: a list is not truncated to
 * 60, deduplicated down to three copies, or stripped of the code it should not
 * hold. A caller that sent an illegal deck gets a typed error naming the rule
 * it broke, because the alternative — starting a duel with a deck the player
 * never assembled — is indistinguishable from the engine misbehaving.
 */
export function parseDuelDeckSelection(value: unknown): DuelDeckSelection {
  const selection = requireRecord(value);
  if (selection.kind === "preset") {
    requireOnlyKeys(selection, ["kind", "deckId"]);
    if (typeof selection.deckId !== "string" || !isDeckId(selection.deckId)) {
      throw new DuelCommandValidationError(
        "Duel deck selection deckId is not a bundled deck",
      );
    }
    return Object.freeze({ kind: "preset" as const, deckId: selection.deckId });
  }
  if (selection.kind !== "cards") {
    throw new DuelCommandValidationError(
      'Duel deck selection kind must be "preset" or "cards"',
    );
  }
  requireOnlyKeys(selection, ["kind", "main", "extra", "side"]);
  const main = cardCodes(selection.main, "main", MINIMUM_MAIN, MAXIMUM_MAIN);
  const extra = cardCodes(selection.extra, "extra", 0, MAXIMUM_EXTRA);
  const side = cardCodes(selection.side, "side", 0, MAXIMUM_SIDE);
  requireCopyLimit(main, extra, side);
  return Object.freeze({ kind: "cards" as const, main, extra, side });
}

function cardCodes(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): readonly number[] {
  if (!Array.isArray(value)) {
    throw new DuelCommandValidationError(
      `Duel deck selection ${field} must be an array of card codes`,
    );
  }
  if (value.length < minimum || value.length > maximum) {
    throw new DuelCommandValidationError(
      `Duel deck selection ${field} must hold ${minimum}-${maximum} cards; found ${value.length}`,
    );
  }
  for (let index = 0; index < value.length; index += 1) {
    /* A hole is not `undefined` reached by chance: a sparse array would let a
       sender claim a 40-card deck while supplying fewer real codes. */
    if (!(index in value)) {
      throw new DuelCommandValidationError(
        `Duel deck selection ${field} must be a dense array`,
      );
    }
    const code: unknown = value[index];
    if (typeof code !== "number" || !Number.isSafeInteger(code) || code <= 0) {
      throw new DuelCommandValidationError(
        `Duel deck selection ${field} holds a value that is not a card code`,
      );
    }
  }
  return Object.freeze([...(value as readonly number[])]);
}

/* Copies are counted across all three zones, matching the deck editor's own
   limit, so a deck cannot slip a fourth copy past the Worker by parking it in
   the Side Deck. */
function requireCopyLimit(...zones: readonly (readonly number[])[]): void {
  const counts = new Map<number, number>();
  for (const zone of zones) {
    for (const code of zone) {
      const total = (counts.get(code) ?? 0) + 1;
      if (total > MAXIMUM_COPIES) {
        throw new DuelCommandValidationError(
          `Duel deck selection holds more than ${MAXIMUM_COPIES} copies of card ${code}`,
        );
      }
      counts.set(code, total);
    }
  }
}
