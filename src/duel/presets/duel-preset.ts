import { duelId, type DuelId } from "../contracts/ids.ts";
import type { DeckId } from "./deck-catalog.ts";
import { parseYdk, type ParsedDeck } from "./deck-parser.ts";

export interface DuelPreset {
  readonly id: DuelId;
  readonly playerDeckId: DeckId;
  readonly opponentDeckId: DeckId;
  readonly player: ParsedDeck;
  readonly opponent: ParsedDeck;
}

export function duelPresetId(
  playerDeckId: DeckId,
  opponentDeckId: DeckId,
): DuelId {
  return duelId(`bundled-v1:${playerDeckId}:vs:${opponentDeckId}`);
}

export function createDuelPreset(
  playerDeckId: DeckId,
  opponentDeckId: DeckId,
  sources: ReadonlyMap<DeckId, string>,
): DuelPreset {
  const playerSource = sources.get(playerDeckId);
  if (playerSource === undefined) {
    throw new Error(`Unknown deck id: ${playerDeckId}`);
  }
  const opponentSource = sources.get(opponentDeckId);
  if (opponentSource === undefined) {
    throw new Error(`Unknown deck id: ${opponentDeckId}`);
  }
  return Object.freeze({
    id: duelPresetId(playerDeckId, opponentDeckId),
    playerDeckId,
    opponentDeckId,
    player: parseYdk(playerSource),
    opponent: parseYdk(opponentSource),
  });
}
