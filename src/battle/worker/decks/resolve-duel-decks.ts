import type { DuelDeckSelection } from "../../duel/contracts/duel-deck-selection.ts";
import { duelOperationError } from "../../duel/contracts/duel-error.ts";
import { cardCode } from "../../duel/contracts/ids.ts";
import type { ParsedDeck } from "../../duel/presets/deck-parser.ts";
import type { DeckId } from "../../duel/presets/deck-catalog.ts";
import type { DuelRuntimeResources } from "../DuelWorkerRuntime.ts";

/** Enough offending codes to recognise the deck that was rejected, few enough
    that a wholly unsupported list cannot turn one error into a card dump. */
const MAXIMUM_REPORTED_CODES = 10;

export interface ResolvedDuelDecks {
  readonly player: ParsedDeck;
  readonly opponent: ParsedDeck;
  /** Non-null only when both seats named a bundled preset, which is the one
      case where the duel has an id the Worker can derive for itself. */
  readonly presetId: string | null;
}

/**
 * Turns two validated seat selections into the decks the engine is handed.
 *
 * The result never leaves the Worker: it feeds `DuelSession` and the rules
 * profile, and nothing built from it is put on a `DuelWorkerEvent`. That is
 * what keeps an opponent's list from becoming readable on the main thread just
 * because the Worker had to resolve it.
 */
export function resolveDuelDecks(
  player: DuelDeckSelection,
  opponent: DuelDeckSelection,
  resources: DuelRuntimeResources,
): ResolvedDuelDecks {
  const resolved =
    player.kind === "preset" && opponent.kind === "preset"
      ? presetPair(player.deckId, opponent.deckId, resources)
      : Object.freeze({
          player: seatDeck(player, resources),
          opponent: seatDeck(opponent, resources),
          presetId: null,
        });
  /* Both seats, before any core session exists. A card the snapshot cannot
     script or draw breaks the duel for whichever seat holds it, and a duel
     that dies three turns in is far worse than one that refuses to start.

     The codes named in the failure are only ever codes the caller already
     holds: an explicit list it sent itself, or a bundled preset whose `.ydk`
     ships in the same build. Nothing hidden is disclosed by naming them. */
  assertSupportedCards(
    [...deckCodes(resolved.player), ...deckCodes(resolved.opponent)],
    resources.dependencies.cards,
    new Set(resources.dependencies.images.keys()),
  );
  return resolved;
}

/** Refuses codes the active snapshot cannot play: absent card data means no
    engine record and no script, absent art means an unrenderable board. */
export function assertSupportedCards(
  codes: readonly number[],
  cards: ReadonlyMap<number, unknown>,
  imageCodes: ReadonlySet<number>,
): void {
  const offending: number[] = [];
  for (const code of new Set(codes)) {
    if (!cards.has(code) || !imageCodes.has(code)) offending.push(code);
  }
  if (offending.length === 0) return;
  const reported = offending.slice(0, MAXIMUM_REPORTED_CODES);
  const ellipsis = offending.length > reported.length ? ", …" : "";
  throw duelOperationError(
    "unsupported_card",
    `Duel cannot start: ${offending.length} card code(s) are outside the active snapshot: ${reported.join(", ")}${ellipsis}`,
  );
}

function presetPair(
  playerDeckId: DeckId,
  opponentDeckId: DeckId,
  resources: DuelRuntimeResources,
): ResolvedDuelDecks {
  const preset = resources.createPreset(playerDeckId, opponentDeckId);
  return Object.freeze({
    player: preset.player,
    opponent: preset.opponent,
    presetId: preset.id,
  });
}

function seatDeck(
  selection: DuelDeckSelection,
  resources: DuelRuntimeResources,
): ParsedDeck {
  if (selection.kind === "cards") {
    return Object.freeze({
      main: Object.freeze(selection.main.map(cardCode)),
      extra: Object.freeze(selection.extra.map(cardCode)),
      side: Object.freeze(selection.side.map(cardCode)),
    });
  }
  /* `createPreset` is the only way to reach a bundled deck's parsed form, and
     it always builds a pair. Naming the same deck twice yields that deck as
     both seats and costs one extra parse of a file already in memory; the
     opposite seat of the returned preset is discarded. */
  return resources.createPreset(selection.deckId, selection.deckId).player;
}

function deckCodes(deck: ParsedDeck): readonly number[] {
  return [...deck.main, ...deck.extra, ...deck.side];
}
