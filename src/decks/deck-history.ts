import type {
  DeckCardLists,
  DeckCardUpdate,
  DeckHistory,
  DeckId,
} from "./deck-contracts.ts";
import { cloneCardLists } from "./deck-contracts.ts";

export const MAXIMUM_DECK_UPDATES = 50;

export function emptyDeckHistory(): DeckHistory {
  return Object.freeze({
    undo: Object.freeze([]),
    redo: Object.freeze([]),
    nextSequence: 1,
  });
}

export function pushDeckUpdate(
  history: DeckHistory,
  input: {
    readonly deckId: DeckId;
    readonly before: DeckCardLists;
    readonly after: DeckCardLists;
    readonly reason: DeckCardUpdate["reason"];
    readonly beforeImportedNeedsReview?: boolean;
    readonly afterImportedNeedsReview?: boolean;
    readonly beforeIllustrationCardCode?: number | null;
    readonly afterIllustrationCardCode?: number | null;
    readonly now?: Date;
    readonly id?: string;
  },
): DeckHistory {
  if (
    sameCards(input.before, input.after, input.reason === "import") &&
    (input.beforeImportedNeedsReview ?? false) ===
      (input.afterImportedNeedsReview ?? false) &&
    (input.beforeIllustrationCardCode ?? null) ===
      (input.afterIllustrationCardCode ?? null)
  )
    return history;
  const update: DeckCardUpdate = Object.freeze({
    id: input.id ?? crypto.randomUUID(),
    deckId: input.deckId,
    sequence: history.nextSequence,
    createdAt: (input.now ?? new Date()).toISOString(),
    before: cloneCardLists(input.before),
    after: cloneCardLists(input.after),
    beforeImportedNeedsReview: input.beforeImportedNeedsReview ?? false,
    afterImportedNeedsReview: input.afterImportedNeedsReview ?? false,
    beforeIllustrationCardCode: input.beforeIllustrationCardCode ?? null,
    afterIllustrationCardCode: input.afterIllustrationCardCode ?? null,
    reason: input.reason,
  });
  return Object.freeze({
    undo: Object.freeze([...history.undo, update].slice(-MAXIMUM_DECK_UPDATES)),
    redo: Object.freeze([]),
    nextSequence: history.nextSequence + 1,
  });
}

export function undoDeckUpdate(history: DeckHistory): Readonly<{
  history: DeckHistory;
  cards: DeckCardLists;
  importedNeedsReview: boolean;
  illustrationCardCode: number | null;
}> | null {
  const update = history.undo.at(-1);
  if (update === undefined) return null;
  return Object.freeze({
    cards: cloneCardLists(update.before),
    importedNeedsReview: update.beforeImportedNeedsReview,
    illustrationCardCode: update.beforeIllustrationCardCode,
    history: Object.freeze({
      undo: Object.freeze(history.undo.slice(0, -1)),
      redo: Object.freeze([update, ...history.redo]),
      nextSequence: history.nextSequence,
    }),
  });
}

export function redoDeckUpdate(history: DeckHistory): Readonly<{
  history: DeckHistory;
  cards: DeckCardLists;
  importedNeedsReview: boolean;
  illustrationCardCode: number | null;
}> | null {
  const update = history.redo[0];
  if (update === undefined) return null;
  return Object.freeze({
    cards: cloneCardLists(update.after),
    importedNeedsReview: update.afterImportedNeedsReview,
    illustrationCardCode: update.afterIllustrationCardCode,
    history: Object.freeze({
      undo: Object.freeze(
        [...history.undo, update].slice(-MAXIMUM_DECK_UPDATES),
      ),
      redo: Object.freeze(history.redo.slice(1)),
      nextSequence: history.nextSequence,
    }),
  });
}

function sameCards(
  left: DeckCardLists,
  right: DeckCardLists,
  orderSensitive = false,
): boolean {
  /* Membership edits stay position-blind, so reorder and sort do not spend an
     undo step. Import replaces exact lists, so its undo must preserve source
     order even when both lists contain the same cards. */
  const same = orderSensitive ? sameOrderedZone : sameZone;
  return (
    same(left.main, right.main) &&
    same(left.extra, right.extra) &&
    same(left.side, right.side)
  );
}

function sameOrderedZone(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((code, index) => code === right[index])
  );
}

function sameZone(left: readonly number[], right: readonly number[]): boolean {
  /* Default lexicographic sort is a canonical form, not a meaningful order,
     and both sides go through the same one. */
  return [...left].sort().join(",") === [...right].sort().join(",");
}
