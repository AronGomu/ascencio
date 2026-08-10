import type { CardCode } from "../duel/contracts/ids.ts";
import { isCardIdentityVisible } from "../duel/card-visibility.ts";
import type {
  PlayerIndex,
  PublicCard,
  PublicDuelState,
  PublicLocation,
} from "../duel/contracts/public-duel-state.ts";
import type { PhysicalZoneId } from "./duel-field-layout.ts";
import type {
  BoardCardText,
  BoardStackView,
  BoardViewModel,
} from "./board-view-model.ts";

/** Identity resolution is always for the local human viewer. */
const LOCAL_VIEWER: PlayerIndex = 0;

export interface ZoneListEntry {
  /** Stable within one rendered list: `${stackId}:${position}`. */
  readonly id: string;
  /** 1-based position in the pile, bottom-first for graveyard and banished, top-first for deck and extra deck. */
  readonly position: number;
  readonly controller: PlayerIndex;
  readonly location: PublicLocation;
  readonly sequence: number;
  readonly identityVisible: boolean;
  readonly code?: CardCode;
  readonly label: string;
}

/** Piles whose contents come straight from the snapshot, in array order. */
type SourcedStackZone = "extra" | "graveyard" | "banished";

export function zoneListEntries(
  stack: BoardStackView,
  snapshot: PublicDuelState,
  cardTexts: ReadonlyMap<number, BoardCardText>,
): readonly ZoneListEntry[] {
  if (stack.zone === "deck") return syntheticDeckEntries(stack);
  const player = snapshot.players[stack.player];
  const collection = sourceCollection(player, stack.zone);
  return Object.freeze(
    collection.map((card, index) =>
      sourcedEntry(stack.id, index, card, cardTexts),
    ),
  );
}

export function zoneListsForBoard(
  board: BoardViewModel,
  snapshot: PublicDuelState | null,
  cardTexts: ReadonlyMap<number, BoardCardText>,
): ReadonlyMap<PhysicalZoneId, readonly ZoneListEntry[]> {
  if (snapshot === null) return Object.freeze(new Map());
  return Object.freeze(
    new Map(
      board.stacks.map((stack) => [
        stack.id,
        zoneListEntries(stack, snapshot, cardTexts),
      ]),
    ),
  );
}

function syntheticDeckEntries(stack: BoardStackView): readonly ZoneListEntry[] {
  return Object.freeze(
    Array.from({ length: stack.count }, (_, index) =>
      Object.freeze({
        id: `${stack.id}:${index + 1}`,
        position: index + 1,
        controller: stack.player,
        location: "deck" as const,
        sequence: index,
        identityVisible: false,
        label: "Face-down card",
      }),
    ),
  );
}

function sourceCollection(
  player: PublicDuelState["players"][number],
  zone: SourcedStackZone,
): readonly PublicCard[] {
  switch (zone) {
    case "extra":
      return player.extraDeck;
    case "graveyard":
      return player.graveyard;
    case "banished":
      return player.banished;
  }
}

function sourcedEntry(
  stackId: PhysicalZoneId,
  index: number,
  card: PublicCard,
  cardTexts: ReadonlyMap<number, BoardCardText>,
): ZoneListEntry {
  const identityVisible =
    isCardIdentityVisible(
      LOCAL_VIEWER,
      card.controller,
      card.location,
      card.position,
    ) && card.code !== undefined;
  const label = identityVisible
    ? (cardTexts.get(card.code as CardCode)?.name ?? `Card ${card.code}`)
    : "Face-down card";
  return Object.freeze({
    id: `${stackId}:${index + 1}`,
    position: index + 1,
    controller: card.controller,
    location: card.location,
    sequence: card.sequence,
    identityVisible,
    ...(identityVisible ? { code: card.code } : {}),
    label,
  });
}
