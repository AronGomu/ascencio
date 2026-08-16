import type { DeckCardLists, DeckRecord, DeckZone } from "./deck-contracts.ts";
import { cloneCardLists, deckId } from "./deck-contracts.ts";
import type { DeckBuilderCardView } from "./catalog/ocg-card-mapper.ts";
import {
  quantityLimit,
  type PinnedDeckRuleset,
} from "./catalog/pinned-ruleset.ts";
import { validateDeckDraft } from "./deck-validation.ts";

export type DeckCommand =
  | Readonly<{ type: "add"; cardCode: number; zone?: DeckZone }>
  | Readonly<{ type: "remove"; cardCode: number; zone: DeckZone }>
  | Readonly<{
      type: "move";
      cardCode: number;
      from: DeckZone;
      to: DeckZone;
    }>
  | Readonly<{ type: "import"; cards: DeckCardLists }>
  | Readonly<{ type: "restore"; cards: DeckCardLists }>
  | Readonly<{ type: "reorder"; zone: DeckZone; from: number; to: number }>
  | Readonly<{ type: "sort"; mode: "alpha" | "type" }>;

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
      cards:
        command.mode === "alpha"
          ? sortDeckCardsAlphabetical(next, catalog)
          : sortDeckCards(next, catalog),
      reason: "sort",
    });

  if (command.type === "reorder") {
    const zone = next[command.zone];
    if (
      !Number.isInteger(command.from) ||
      command.from < 0 ||
      command.from >= zone.length ||
      command.to < 0
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
    if (!removeFirst(next[command.zone], command.cardCode))
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
    if (!removeFirst(next[command.from], command.cardCode))
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

export function sortDeckCards(
  cards: DeckCardLists,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
): DeckCardLists {
  const compare =
    (zone: DeckZone) =>
    (left: number, right: number): number => {
      const a = catalog.get(left);
      const b = catalog.get(right);
      if (a === undefined || b === undefined) return left - right;
      const group = (card: DeckBuilderCardView): number => {
        const extraOrder = ["Fusion", "Synchro", "Xyz", "Link"];
        if (
          zone === "extra" ||
          (zone === "side" && card.canonicalZone === "extra")
        ) {
          const subtype = Math.min(
            ...card.subtypes.map((type) => {
              const index = extraOrder.indexOf(type);
              return index < 0 ? extraOrder.length : index;
            }),
          );
          return (zone === "side" ? 3 : 0) + subtype;
        }
        return card.family === "monster" ? 0 : card.family === "spell" ? 1 : 2;
      };
      return (
        group(a) - group(b) || a.name.localeCompare(b.name) || a.code - b.code
      );
    };
  return Object.freeze({
    main: Object.freeze([...cards.main].sort(compare("main"))),
    extra: Object.freeze([...cards.extra].sort(compare("extra"))),
    side: Object.freeze([...cards.side].sort(compare("side"))),
  });
}

export function sortDeckCardsAlphabetical(
  cards: DeckCardLists,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
): DeckCardLists {
  /* A code with no catalog entry has no name to sort by and no tile to read,
     so it sinks to the end of its zone rather than sorting as an empty name
     ahead of every real card. */
  const compare = (left: number, right: number): number => {
    const a = catalog.get(left);
    const b = catalog.get(right);
    if (a === undefined || b === undefined)
      return a === b ? left - right : a === undefined ? 1 : -1;
    return a.name.localeCompare(b.name) || a.code - b.code;
  };
  return Object.freeze({
    main: Object.freeze([...cards.main].sort(compare)),
    extra: Object.freeze([...cards.extra].sort(compare)),
    side: Object.freeze([...cards.side].sort(compare)),
  });
}

export function mainDeckGridPlan(count: number): DeckGridPlan {
  if (count <= 40)
    return Object.freeze({ columns: 10, rows: 4, slots: 40, compact: false });
  if (count <= 50)
    return Object.freeze({ columns: 10, rows: 5, slots: 50, compact: false });
  return Object.freeze({ columns: 10, rows: 6, slots: 60, compact: false });
}

export const FIFTEEN_CARD_GRID: DeckGridPlan = Object.freeze({
  columns: 5,
  rows: 3,
  slots: 15,
  compact: false,
});

function removeFirst(values: number[], code: number): boolean {
  const index = values.indexOf(code);
  if (index < 0) return false;
  values.splice(index, 1);
  return true;
}
