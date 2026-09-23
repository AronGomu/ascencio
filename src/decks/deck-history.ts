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
  const forceSnapshot = input.reason === "sort";
  if (
    !forceSnapshot &&
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

export function undoDeckUpdate(
  history: DeckHistory,
  currentCards: DeckCardLists,
): Readonly<{
  history: DeckHistory;
  cards: DeckCardLists;
  importedNeedsReview: boolean;
  illustrationCardCode: number | null;
}> | null {
  const update = history.undo.at(-1);
  if (update === undefined) return null;
  const cards = restoreCards(currentCards, update.before, update.reason);
  return Object.freeze({
    cards,
    importedNeedsReview: update.beforeImportedNeedsReview,
    illustrationCardCode: update.beforeIllustrationCardCode,
    history: Object.freeze({
      undo: Object.freeze(history.undo.slice(0, -1)),
      redo: Object.freeze([
        withCardSnapshots(update, cards, currentCards),
        ...history.redo,
      ]),
      nextSequence: history.nextSequence,
    }),
  });
}

export function redoDeckUpdate(
  history: DeckHistory,
  currentCards: DeckCardLists,
): Readonly<{
  history: DeckHistory;
  cards: DeckCardLists;
  importedNeedsReview: boolean;
  illustrationCardCode: number | null;
}> | null {
  const update = history.redo[0];
  if (update === undefined) return null;
  const cards = restoreCards(currentCards, update.after, update.reason);
  return Object.freeze({
    cards,
    importedNeedsReview: update.afterImportedNeedsReview,
    illustrationCardCode: update.afterIllustrationCardCode,
    history: Object.freeze({
      undo: Object.freeze(
        [...history.undo, withCardSnapshots(update, currentCards, cards)].slice(
          -MAXIMUM_DECK_UPDATES,
        ),
      ),
      redo: Object.freeze(history.redo.slice(1)),
      nextSequence: history.nextSequence,
    }),
  });
}

function restoreCards(
  current: DeckCardLists,
  target: DeckCardLists,
  reason: DeckCardUpdate["reason"],
): DeckCardLists {
  if (reason === "import" || reason === "restore" || reason === "sort")
    return cloneCardLists(target);
  return cloneCardLists({
    main: restoreZoneMembership(current.main, target.main),
    extra: restoreZoneMembership(current.extra, target.extra),
    side: restoreZoneMembership(current.side, target.side),
  });
}

function restoreZoneMembership(
  current: readonly number[],
  target: readonly number[],
): readonly number[] {
  const targetCounts = counts(target);
  const retainedCounts = new Map<number, number>();
  const restored = current.filter((code) => {
    const retained = retainedCounts.get(code) ?? 0;
    if (retained >= (targetCounts.get(code) ?? 0)) return false;
    retainedCounts.set(code, retained + 1);
    return true;
  });
  const representedCounts = new Map<number, number>();
  target.forEach((code, index) => {
    const represented = representedCounts.get(code) ?? 0;
    representedCounts.set(code, represented + 1);
    if (represented < (retainedCounts.get(code) ?? 0)) return;
    restored.splice(Math.min(index, restored.length), 0, code);
  });
  return restored;
}

function counts(values: readonly number[]): ReadonlyMap<number, number> {
  const result = new Map<number, number>();
  values.forEach((value) => result.set(value, (result.get(value) ?? 0) + 1));
  return result;
}

function withCardSnapshots(
  update: DeckCardUpdate,
  before: DeckCardLists,
  after: DeckCardLists,
): DeckCardUpdate {
  if (
    update.reason === "import" ||
    update.reason === "restore" ||
    update.reason === "sort"
  )
    return update;
  return Object.freeze({
    ...update,
    before: cloneCardLists(before),
    after: cloneCardLists(after),
  });
}

function sameCards(
  left: DeckCardLists,
  right: DeckCardLists,
  orderSensitive = false,
): boolean {
  /* Membership edits stay position-blind. Import replaces exact lists, so its
     undo must preserve the source order it displaced. Sort bypasses this
     equality check because every explicit sort is its own undoable action. */
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
