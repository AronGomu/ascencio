import type { DeckZone } from "../../decks/deck-contracts.ts";

/* What a left click on a tile means. Derived from the tile's zone and the
   deck's fill, never from anything the layout happens to be showing. */
export type ClickIntent =
  | Readonly<{ kind: "move"; to: DeckZone }>
  | Readonly<{ kind: "remove" }>
  | Readonly<{ kind: "add"; zone: DeckZone }>
  | Readonly<{ kind: "blocked"; reason: string }>;

export interface ZoneCounts {
  readonly main: number;
  readonly extra: number;
  readonly side: number;
}

const MAIN_ZONE_CAPACITY = 60;
const FIFTEEN_ZONE_CAPACITY = 15;

const FULL_REASON: Readonly<Record<DeckZone, string>> = {
  main: "Main Deck is full.",
  extra: "Extra Deck is full.",
  side: "Side Deck is full.",
};

function capacityOf(zone: DeckZone): number {
  return zone === "main" ? MAIN_ZONE_CAPACITY : FIFTEEN_ZONE_CAPACITY;
}

function isFull(zone: DeckZone, counts: ZoneCounts): boolean {
  return counts[zone] >= capacityOf(zone);
}

function moveOrBlocked(to: DeckZone, counts: ZoneCounts): ClickIntent {
  return isFull(to, counts)
    ? { kind: "blocked", reason: FULL_REASON[to] }
    : { kind: "move", to };
}

export function deckCardClickIntent(
  zone: DeckZone,
  canonicalZone: "main" | "extra",
  counts: ZoneCounts,
): ClickIntent {
  /* The Extra Deck has no sideboard of its own to swap against, so a click
     there is the removal the player means. */
  if (zone === "extra") return { kind: "remove" };
  if (zone === "side") return moveOrBlocked(canonicalZone, counts);
  return moveOrBlocked("side", counts);
}

export function catalogCardClickIntent(
  canonicalZone: "main" | "extra",
  counts: ZoneCounts,
  toSideboard: boolean,
): ClickIntent {
  const order: readonly DeckZone[] = toSideboard
    ? ["side", canonicalZone]
    : [canonicalZone, "side"];
  const open = order.find((zone) => !isFull(zone, counts));
  return open === undefined
    ? { kind: "blocked", reason: "No space left." }
    : { kind: "add", zone: open };
}
