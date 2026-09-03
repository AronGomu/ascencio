import type { DeckCardLists, DeckRecord, DeckZone } from "./deck-contracts.ts";
import { cloneCardLists, deckId } from "./deck-contracts.ts";
import type { DeckBuilderCardView } from "./catalog/ocg-card-mapper.ts";
import { isDeckBuildableCard } from "./catalog/deck-buildable-cards.ts";
import {
  quantityLimit,
  type PinnedDeckRuleset,
} from "./catalog/pinned-ruleset.ts";
import { validateDeckDraft } from "./deck-validation.ts";

export type SortMode =
  "alpha" | "type" | "level" | "attribute" | "race" | "atk" | "def";
export type SortDirection = "asc" | "desc";

/* `index` names which copy of a repeated card a command means. A tile knows
   its own position; a drag or an import does not, so it stays optional and the
   first copy answers for the callers that cannot say. */
export type DeckCommand =
  | Readonly<{ type: "add"; cardCode: number; zone?: DeckZone }>
  | Readonly<{
      type: "remove";
      cardCode: number;
      zone: DeckZone;
      index?: number | undefined;
    }>
  | Readonly<{
      type: "move";
      cardCode: number;
      from: DeckZone;
      to: DeckZone;
      index?: number | undefined;
    }>
  | Readonly<{ type: "import"; cards: DeckCardLists }>
  | Readonly<{ type: "restore"; cards: DeckCardLists }>
  | Readonly<{ type: "reorder"; zone: DeckZone; from: number; to: number }>
  | Readonly<{
      type: "sort";
      mode: SortMode;
      direction: SortDirection;
    }>;

export type DeckMutationResult =
  | Readonly<{
      type: "accepted";
      cards: DeckCardLists;
      reason: DeckCommand["type"];
    }>
  | Readonly<{ type: "rejected"; reason: string }>;

export const MAXIMUM_DECK_NAME_LENGTH = 120;

export function normalizeDeckName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Deck name is required");
  if (trimmed.length > MAXIMUM_DECK_NAME_LENGTH)
    throw new Error(
      `Deck name must be ${MAXIMUM_DECK_NAME_LENGTH} characters or fewer`,
    );
  return trimmed;
}

export function derivedDeckName(name: string, suffix: string): string {
  const room = MAXIMUM_DECK_NAME_LENGTH - suffix.length;
  return `${name.trim().slice(0, Math.max(0, room)).trimEnd()}${suffix}`;
}

export interface DeckGridPlan {
  readonly columns: number;
  readonly rows: number;
  readonly slots: number;
  readonly compact: boolean;
}

export function createBlankDeck(
  name: string,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  ruleset: PinnedDeckRuleset,
  options: {
    readonly id?: string;
    readonly now?: Date;
  } = {},
): DeckRecord {
  const trimmed = normalizeDeckName(name);
  const now = (options.now ?? new Date()).toISOString();
  const cards = cloneCardLists({ main: [], extra: [], side: [] });
  return Object.freeze({
    schemaVersion: 1,
    id: deckId(options.id ?? crypto.randomUUID()),
    revision: 0,
    name: trimmed,
    ...cards,
    createdAt: now,
    updatedAt: now,
    validation: validateDeckDraft(cards, catalog, ruleset),
    importedNeedsReview: false,
    illustrationCardCode: null,
  });
}

export function applyDeckCommand(
  deck: DeckCardLists,
  command: DeckCommand,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  ruleset: PinnedDeckRuleset,
): DeckMutationResult {
  /* A deck's order is the player's, so no command re-packs the lists on its
     way through: cards land at the end of their zone and stay where they were
     put. `reorder` and `sort` are the only ways a position moves on its own. */
  if (command.type === "import" || command.type === "restore")
    return Object.freeze({
      type: "accepted",
      cards: cloneCardLists(command.cards),
      reason: command.type,
    });

  const next = {
    main: [...deck.main],
    extra: [...deck.extra],
    side: [...deck.side],
  } satisfies Record<DeckZone, number[]>;

  if (command.type === "sort")
    return Object.freeze({
      type: "accepted",
      cards: sortDeckCards(next, catalog, command.mode, command.direction),
      reason: "sort",
    });

  if (command.type === "reorder") {
    const zone = next[command.zone];
    if (
      !Number.isInteger(command.from) ||
      command.from < 0 ||
      command.from >= zone.length ||
      !Number.isInteger(command.to) ||
      command.to < 0 ||
      /* Dropping a tile back on its own slot is not an edit, and accepting it
         would spend an autosave slot on a deck identical to its predecessor. */
      command.from === command.to
    )
      return Object.freeze({
        type: "rejected",
        reason: "Nothing to reorder.",
      });
    /* Dropping onto an occupied slot swaps the two cards, which keeps every
       other tile still under the pointer; dropping past the last card is the
       one gesture that means "append", so it splices instead. */
    if (command.to < zone.length)
      [zone[command.from], zone[command.to]] = [
        zone[command.to]!,
        zone[command.from]!,
      ];
    else zone.push(...zone.splice(command.from, 1));
    return Object.freeze({
      type: "accepted",
      cards: cloneCardLists(next),
      reason: "reorder",
    });
  }

  if (command.type === "remove") {
    if (!removeCopy(next[command.zone], command.cardCode, command.index))
      return Object.freeze({
        type: "rejected",
        reason: "Card is not in that zone.",
      });
    return Object.freeze({
      type: "accepted",
      cards: cloneCardLists(next),
      reason: "remove",
    });
  }

  const card = catalog.get(command.cardCode);
  if (card === undefined)
    return Object.freeze({
      type: "rejected",
      reason: "Card is missing from catalog.",
    });

  if (command.type === "add") {
    /* A Token is dealt onto the field by the duel, never held in a deck, and
       the catalog carries all 243 of them so the duel can name one. */
    if (!isDeckBuildableCard(card))
      return Object.freeze({
        type: "rejected",
        reason: "Tokens cannot be added to a deck.",
      });
    const zone = command.zone ?? card.canonicalZone;
    if (zone !== card.canonicalZone && zone !== "side")
      return Object.freeze({
        type: "rejected",
        reason: "Card cannot be added to that zone.",
      });
    const count = [...next.main, ...next.extra, ...next.side].filter(
      (code) => code === command.cardCode,
    ).length;
    const limit = quantityLimit(ruleset, command.cardCode);
    if (limit === 0)
      return Object.freeze({ type: "rejected", reason: "Card is forbidden." });
    if (count >= limit)
      return Object.freeze({
        type: "rejected",
        reason: `Copy limit ${limit} reached.`,
      });
    next[zone].push(command.cardCode);
  } else {
    if (command.from === command.to)
      return Object.freeze({
        type: "rejected",
        reason: "Card is already in that zone.",
      });
    const legalTarget =
      command.to === "side" ||
      (command.from === "side" && command.to === card.canonicalZone);
    if (!legalTarget)
      return Object.freeze({
        type: "rejected",
        reason: "Card cannot move to that zone.",
      });
    if (!removeCopy(next[command.from], command.cardCode, command.index))
      return Object.freeze({
        type: "rejected",
        reason: "Card is not in that zone.",
      });
    next[command.to].push(command.cardCode);
  }

  return Object.freeze({
    type: "accepted",
    cards: cloneCardLists(next),
    reason: command.type,
  });
}

interface SortableDeckCard {
  readonly code: number;
  readonly index: number;
  readonly card: DeckBuilderCardView | undefined;
}

export function sortDeckCards(
  cards: DeckCardLists,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  mode: SortMode = "type",
  direction: SortDirection = "asc",
): DeckCardLists {
  const sortZone = (codes: readonly number[], zone: DeckZone) =>
    Object.freeze(
      codes
        .map((code, index) => ({ code, index, card: catalog.get(code) }))
        .sort((left, right) =>
          compareDeckCards(left, right, zone, mode, direction),
        )
        .map(({ code }) => code),
    );
  return Object.freeze({
    main: sortZone(cards.main, "main"),
    extra: sortZone(cards.extra, "extra"),
    side: sortZone(cards.side, "side"),
  });
}

export function sortDeckCardsAlphabetical(
  cards: DeckCardLists,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
): DeckCardLists {
  return sortDeckCards(cards, catalog, "alpha", "asc");
}

function compareDeckCards(
  left: SortableDeckCard,
  right: SortableDeckCard,
  zone: DeckZone,
  mode: SortMode,
  direction: SortDirection,
): number {
  const primary = compareNullable(
    sortPrimary(left, zone, mode),
    sortPrimary(right, zone, mode),
    direction,
  );
  if (primary !== 0) return primary;
  if (mode !== "alpha" && mode !== "type") {
    const type = compareNullable(
      cardTypeRank(left.card, zone),
      cardTypeRank(right.card, zone),
      "asc",
    );
    if (type !== 0) return type;
  }
  if (mode !== "alpha") {
    const name = cardName(left).localeCompare(cardName(right));
    if (name !== 0) return name;
  }
  return left.index - right.index;
}

function sortPrimary(
  value: SortableDeckCard,
  zone: DeckZone,
  mode: SortMode,
): string | number | null {
  if (mode === "alpha") return cardName(value);
  if (mode === "type") return cardTypeRank(value.card, zone);
  const card = value.card;
  if (card === undefined) return null;
  if (mode === "level") return knownNumber(card.levelRankLink);
  if (mode === "attribute") return knownText(card.attribute, "Attribute ");
  if (mode === "race") return knownText(card.race, "Race ");
  if (mode === "atk") return knownNumber(card.attack);
  return knownNumber(card.defense);
}

function cardName({ card, code }: SortableDeckCard): string {
  return card?.name ?? `Card ${code}`;
}

function cardTypeRank(
  card: DeckBuilderCardView | undefined,
  zone: DeckZone,
): number | null {
  if (card === undefined) return null;
  const extraOrder = ["Fusion", "Synchro", "Xyz", "Link"];
  if (zone === "extra" || (zone === "side" && card.canonicalZone === "extra")) {
    const subtype = extraOrder.findIndex((type) =>
      card.subtypes.includes(type),
    );
    return subtype < 0 ? null : (zone === "side" ? 3 : 0) + subtype;
  }
  return card.family === "monster" ? 0 : card.family === "spell" ? 1 : 2;
}

function knownNumber(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function knownText(value: string | null, unknownPrefix: string): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length === 0 || normalized.startsWith(unknownPrefix)
    ? null
    : normalized;
}

function compareNullable(
  left: string | number | null,
  right: string | number | null,
  direction: SortDirection,
): number {
  if (left === null || right === null)
    return left === right ? 0 : left === null ? 1 : -1;
  const compared =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right));
  return direction === "asc" ? compared : -compared;
}

export function mainDeckGridPlan(count: number): DeckGridPlan {
  if (count <= 40)
    return Object.freeze({ columns: 10, rows: 4, slots: 40, compact: false });
  if (count <= 50)
    return Object.freeze({ columns: 10, rows: 5, slots: 50, compact: false });
  return Object.freeze({ columns: 10, rows: 6, slots: 60, compact: false });
}

export const FIFTEEN_CARD_GRID: DeckGridPlan = Object.freeze({
  columns: 15,
  rows: 1,
  slots: 15,
  compact: true,
});

/* An index only decides anything when it still names the card it was read
   from, so a stale one falls back to the first copy rather than removing a
   neighbour the player never clicked. */
function removeCopy(
  values: number[],
  code: number,
  index: number | undefined,
): boolean {
  if (index !== undefined && values[index] === code) {
    values.splice(index, 1);
    return true;
  }
  return removeFirst(values, code);
}

function removeFirst(values: number[], code: number): boolean {
  const index = values.indexOf(code);
  if (index < 0) return false;
  values.splice(index, 1);
  return true;
}
