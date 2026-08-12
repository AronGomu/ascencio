import { writable, type Readable } from "svelte/store";
import type { DeckId } from "../../duel/presets/deck-catalog.ts";
import {
  readPersistedUiState,
  writePersistedUiState,
  type PersistedUiState,
  type PersistedWindowPosition,
} from "./persisted-ui-state.ts";

export interface PersistedUiStore extends Readable<PersistedUiState> {
  setDecks(player: DeckId, opponent: DeckId): void;
  setWindowPosition(
    window: "zoneList" | "confirm",
    position: PersistedWindowPosition | null,
  ): void;
}

/* One live owner for `ygo.ui.v1` (ADR-013). Every setter replaces exactly one
   field and writes the complete v1 state back through the pure T3 functions,
   which already swallow unavailable/blocked/full storage, so a persistence
   failure can never interrupt play. */
export function createPersistedUiStore(
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): PersistedUiStore {
  const { subscribe, update } = writable<PersistedUiState>(
    readPersistedUiState(storage),
  );

  function persist(next: (state: PersistedUiState) => PersistedUiState): void {
    update((state) => {
      const value = next(state);
      writePersistedUiState(value, storage);
      return value;
    });
  }

  return {
    subscribe,
    setDecks(player: DeckId, opponent: DeckId): void {
      persist((state) =>
        Object.freeze({
          ...state,
          decks: Object.freeze({ player, opponent }),
        }),
      );
    },
    setWindowPosition(
      window: "zoneList" | "confirm",
      position: PersistedWindowPosition | null,
    ): void {
      persist((state) =>
        Object.freeze({
          ...state,
          windows: Object.freeze({ ...state.windows, [window]: position }),
        }),
      );
    },
  };
}
