import { isProjectedCardIdentityKnown } from "../duel/card-visibility.ts";
import type { CardCode } from "../duel/contracts/ids.ts";
import type {
  PlayerIndex,
  PublicCard,
  PublicDuelState,
  PublicLocation,
} from "../duel/contracts/public-duel-state.ts";
import {
  interactionChoicesInPromptOrder,
  type ActiveInteractionSpec,
  type InteractionChoice,
} from "../app/prompts/interaction-spec.ts";
import type { BoardCardText } from "./board-view-model.ts";
import type { ZoneListEntry } from "./zone-list.ts";

export type OffFieldZoneBadge =
  | "HAND"
  | "EXTRA DECK"
  | "GRAVEYARD"
  | "BANISHED"
  | "DECK";

export const OFF_FIELD_ZONE_DISPLAY_ORDER: readonly OffFieldZoneBadge[] =
  Object.freeze(["HAND", "EXTRA DECK", "GRAVEYARD", "BANISHED", "DECK"]);

export interface OffFieldTargetEntry extends ZoneListEntry {
  readonly zoneBadge: OffFieldZoneBadge;
  /** Owner-aware expanded zone name for assistive technology. */
  readonly zoneLabel: string;
  readonly choices: readonly InteractionChoice[];
}

const ZONE_BADGES: Partial<Record<PublicLocation, OffFieldZoneBadge>> =
  Object.freeze({
    hand: "HAND",
    graveyard: "GRAVEYARD",
    deck: "DECK",
    banished: "BANISHED",
    extra: "EXTRA DECK",
  });

const ZONE_NAMES: Readonly<Record<OffFieldZoneBadge, string>> = Object.freeze({
  HAND: "Hand",
  "EXTRA DECK": "Extra Deck",
  GRAVEYARD: "Graveyard",
  BANISHED: "Banished",
  DECK: "Deck",
});

export function offFieldZoneBadge(
  location: PublicLocation,
): OffFieldZoneBadge | null {
  return ZONE_BADGES[location] ?? null;
}

/**
 * The legal off-field targets of one prompt, aggregated across every pile and
 * the hand, in raw prompt order.
 *
 * Identity comes only from the sanitized projected snapshot: a prompt choice
 * never reveals a card. An address the projector cannot attest still renders
 * as an answerable hidden entry, because the engine prompt — not the
 * projection — decides what is legal.
 */
export function offFieldTargetEntries(
  spec: ActiveInteractionSpec,
  snapshot: PublicDuelState,
  cardTexts: ReadonlyMap<number, BoardCardText>,
): readonly OffFieldTargetEntry[] {
  const offFieldIds = new Set(spec.offFieldChoices.map(({ id }) => id));
  const grouped = new Map<string, InteractionChoice[]>();
  for (const choice of interactionChoicesInPromptOrder(spec)) {
    const address = choice.cardAddress;
    if (address === undefined || !offFieldIds.has(choice.id)) continue;
    const key = `${address.controller}:${address.location}:${address.sequence}`;
    const current = grouped.get(key);
    if (current === undefined) grouped.set(key, [choice]);
    else current.push(choice);
  }

  const entries: OffFieldTargetEntry[] = [];
  for (const choices of grouped.values()) {
    const entry = targetEntry(choices, snapshot, cardTexts);
    if (entry !== null) entries.push(entry);
  }
  return Object.freeze(entries);
}

function targetEntry(
  choices: readonly InteractionChoice[],
  snapshot: PublicDuelState,
  cardTexts: ReadonlyMap<number, BoardCardText>,
): OffFieldTargetEntry | null {
  const address = choices[0]?.cardAddress;
  if (address === undefined) return null;
  const badge = offFieldZoneBadge(address.location);
  if (badge === null) return null;

  const projectedIndex = projectedCardIndex(
    snapshot,
    address.controller,
    address.location,
    address.sequence,
  );
  const card =
    projectedIndex < 0
      ? undefined
      : projectedCards(snapshot, address.controller, address.location)[
          projectedIndex
        ];
  const identityVisible =
    card !== undefined && isProjectedCardIdentityKnown(card);
  const code = identityVisible ? (card.code as CardCode) : undefined;
  return Object.freeze({
    id: `target:${address.controller}:${address.location}:${address.sequence}`,
    /* Visual pile position when the projection carries this address; the
       engine sequence otherwise, which is already part of the entry id and
       therefore reveals nothing new. */
    position: (projectedIndex < 0 ? address.sequence : projectedIndex) + 1,
    controller: address.controller,
    location: address.location,
    sequence: address.sequence,
    identityVisible,
    ...(code === undefined ? {} : { code }),
    label:
      code === undefined
        ? "Face-down card"
        : (cardTexts.get(code)?.name ?? `Card ${code}`),
    zoneBadge: badge,
    zoneLabel: `${address.controller === 0 ? "Your" : "Opponent"} ${ZONE_NAMES[badge]}`,
    choices: Object.freeze([...choices]),
  });
}

/**
 * Engine deck sequences are bottom-first while the projected deck list is
 * top-relative, the same conversion the browse list performs. Every other
 * off-field collection is addressed by its own sequence.
 */
function projectedCardIndex(
  snapshot: PublicDuelState,
  controller: PlayerIndex,
  location: PublicLocation,
  sequence: number,
): number {
  const cards = projectedCards(snapshot, controller, location);
  if (location === "deck") {
    const index = cards.length - 1 - sequence;
    return index >= 0 && index < cards.length ? index : -1;
  }
  return cards.findIndex(
    (card) => card.location === location && card.sequence === sequence,
  );
}

function projectedCards(
  snapshot: PublicDuelState,
  controller: PlayerIndex,
  location: PublicLocation,
): readonly PublicCard[] {
  const player = snapshot.players[controller];
  switch (location) {
    case "hand":
      return player.hand;
    case "deck":
      return player.deck;
    case "extra":
      return player.extraDeck;
    case "graveyard":
      return player.graveyard;
    case "banished":
      return player.banished;
    default:
      return [];
  }
}
