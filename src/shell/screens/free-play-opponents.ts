/** The AI opponents free play offers, and the one bundled deck each of them
    owns. Picking a persona brings its deck along, so the roster is the pairing
    rule rather than a label: nothing here reaches the duel's opponent policy,
    which plays every seat the same way.

    Deck keys are the `SelectableDeck` `preset:${deckId}` form the pickers
    already speak. They are written out rather than derived from the catalog on
    purpose — importing `src/battle/index.ts` from the shell would make the duel
    an eager dependency of the entry chunk. A unit test checks every suffix
    against `DECK_CATALOG` instead, so a renamed preset fails loudly. */
export interface FreePlayOpponent {
  readonly id: "practice-bot" | "blaze-circuit" | "vault-warden";
  readonly name: string;
  /** Tagline under the name in the picker. */
  readonly line: string;
  /** Bundled deck this AI owns; `preset:${deckId}` key format. */
  readonly deckKey: string;
}

export const FREE_PLAY_OPPONENTS: readonly FreePlayOpponent[] = Object.freeze([
  Object.freeze({
    id: "practice-bot",
    name: "Practice Bot",
    line: "No narrative, no save. Pick both decks and duel now.",
    deckKey: "preset:mvp-opponent",
  }),
  Object.freeze({
    id: "blaze-circuit",
    name: "Blaze Circuit",
    line: "Plays fast and punishes hesitation.",
    deckKey: "preset:burning-abyss",
  }),
  Object.freeze({
    id: "vault-warden",
    name: "Vault Warden",
    line: "Locks the board, then closes it out.",
    deckKey: "preset:shaddoll",
  }),
]);

/* Remembering no persona has to duel the deck the opponent seat was always
   fixed to, so the default owns `DEFAULT_OPPONENT_DECK_ID`. */
export const DEFAULT_FREE_PLAY_OPPONENT_ID = "vault-warden";

/* An id remembered from a build that spelled the roster differently names no
   persona today; that is a stale preference, not a reason for the picker to
   render nothing. */
export function freePlayOpponent(id: string): FreePlayOpponent {
  return withId(id) ?? withId(DEFAULT_FREE_PLAY_OPPONENT_ID)!;
}

function withId(id: string): FreePlayOpponent | undefined {
  return FREE_PLAY_OPPONENTS.find((opponent) => opponent.id === id);
}
