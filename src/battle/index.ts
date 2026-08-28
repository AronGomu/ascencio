/** Public contract of the battle domain. The shell and any later cross-domain
    caller import from here only — nothing reaches past this file into the duel
    UI, its worker client or its stores. The duel's own source sits beside this
    file in `app/`, `components/`, `decks/`, `duel/`, `field/`, `storage/` and `worker/`; this entry is
    what makes that an implementation detail. */
export { default as BattleFacade } from "./BattleFacade.svelte";
export type {
  BattleRequest,
  BattleDeckSelection,
  BattleOutcome,
  BattleFacadeResult,
} from "./battle-contracts.ts";
export { parseBattleRequest, BattleRequestError } from "./battle-contracts.ts";
export { settleOnce } from "./settle-once.ts";
export type { SelectableDeck } from "./decks/selectable-decks.ts";
export {
  listSelectableDecks,
  presetSelectableDecks,
  findSelectableDeck,
} from "./decks/selectable-decks.ts";
/* T17: a host that builds its own pairing needs the bundled list `listSelectableDecks`
   takes and the seats to fall back to when a remembered key no longer resolves.
   Metadata only — the `.ydk` payloads stay in `deck-sources-browser.ts`, so this
   carries six names and a file name each, not six decks. */
export {
  DECK_CATALOG,
  DEFAULT_OPPONENT_DECK_ID,
  DEFAULT_PLAYER_DECK_ID,
} from "./duel/presets/deck-catalog.ts";
