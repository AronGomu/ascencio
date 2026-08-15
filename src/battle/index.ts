/** Public contract of the battle domain. The shell and any later cross-domain
    caller import from here only — nothing reaches past this file into the duel
    UI, its worker client or its stores. The duel's own source still lives in
    `src/app/`, `src/duel/`, `src/field/`, `src/worker/` and `src/storage/`;
    this entry is what makes that an implementation detail. */
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
  findSelectableDeck,
  supportedDuelCardCodes,
} from "./decks/selectable-decks.ts";
