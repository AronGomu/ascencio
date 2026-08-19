export type DeckId =
  | "mvp-player"
  | "mvp-opponent"
  | "burning-abyss"
  | "nekroz"
  | "shaddoll"
  | "spellbook";

export interface DeckMetadata {
  readonly id: DeckId;
  readonly name: string;
  /** File name inside `src/battle/duel/presets/decks/`. */
  readonly fileName: string;
}

export const DECK_CATALOG: readonly DeckMetadata[] = Object.freeze([
  Object.freeze({
    id: "mvp-player",
    name: "Starter (Player)",
    fileName: "player.ydk",
  }),
  Object.freeze({
    id: "mvp-opponent",
    name: "Starter (Opponent)",
    fileName: "opponent.ydk",
  }),
  Object.freeze({
    id: "burning-abyss",
    name: "Burning Abyss",
    fileName: "burning-abyss.ydk",
  }),
  Object.freeze({ id: "nekroz", name: "Nekroz", fileName: "nekroz.ydk" }),
  Object.freeze({
    id: "shaddoll",
    name: "Shaddoll",
    fileName: "shaddoll.ydk",
  }),
  Object.freeze({
    id: "spellbook",
    name: "Spellbook",
    fileName: "spellbook.ydk",
  }),
]);

export const DEFAULT_PLAYER_DECK_ID: DeckId = "mvp-player";
/* The seat the player never chooses: the duel menu fixes the opponent to this
   deck, and an existing profile carrying the previous default is rewritten to
   it on load rather than duelling a deck the menu no longer offers. */
export const DEFAULT_OPPONENT_DECK_ID: DeckId = "shaddoll";

export function deckMetadata(id: DeckId): DeckMetadata {
  return DECK_CATALOG.find((metadata) => metadata.id === id)!;
}

export function isDeckId(value: string): value is DeckId {
  return DECK_CATALOG.some(({ id }) => id === value);
}
