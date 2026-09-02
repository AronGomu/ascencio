import type {
  BoardCardView,
  BoardTargetId,
} from "../../field/board-view-model.ts";

/** The player's own hand: the only zone whose selected card the zoom overlay
    may enlarge, since it is the only one whose identity the player already
    sees. A concealed card carries no `code` at all, and is dropped here as
    well as in the hover gate `CardControl` applies. */
export function selectedHandZoomCandidates(
  cards: readonly BoardCardView[],
  selected: ReadonlySet<BoardTargetId>,
): readonly BoardCardView[] {
  return cards.filter(
    (card) =>
      card.player === 0 &&
      card.zoneId === "p0:hand" &&
      card.code !== undefined &&
      selected.has(card.targetId),
  );
}

/** Which of the selected hand cards the overlay serves.

    `selectedChoiceIds` is rebuilt in prompt order on every toggle
    (`interaction-session.ts`), so the session keeps no record of which pick
    came last: recency is read here instead, by diffing the previous selection
    against the current one. A change that adds targets hands the newest of
    them over; one that only removes targets keeps the served card while it is
    still selected, and otherwise falls back to whatever selection remains. */
export function trackLatestSelectedTarget(
  previous: readonly BoardTargetId[],
  next: readonly BoardTargetId[],
  current: BoardTargetId | null,
): BoardTargetId | null {
  const added = next.filter((target) => !previous.includes(target));
  const latest = added.at(-1);
  if (latest !== undefined) return latest;
  if (current !== null && next.includes(current)) return current;
  return next.at(-1) ?? null;
}
