import { writable, type Readable } from "svelte/store";
import {
  readPersistedUiState,
  writePersistedUiState,
  type PersistedDisplaySettings,
  type PersistedUiState,
  type PersistedWindowPosition,
} from "./persisted-ui-state.ts";

export interface PersistedUiStore extends Readable<PersistedUiState> {
  setDecks(playerKey: string, opponentKey: string): void;
  setDisplaySettings(settings: PersistedDisplaySettings): void;
  setWindowPosition(
    window: "zoneList" | "confirm",
    position: PersistedWindowPosition | null,
  ): void;
}

/* One live owner for persisted UI state. Every setter replaces exactly one
   branch and writes the complete state; storage failure never interrupts play. */
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
    setDecks(playerKey: string, opponentKey: string): void {
      persist((state) =>
        Object.freeze({
          ...state,
          decks: Object.freeze({ playerKey, opponentKey }),
        }),
      );
    },
    setDisplaySettings(settings: PersistedDisplaySettings): void {
      persist((state) =>
        Object.freeze({ ...state, settings: Object.freeze({ ...settings }) }),
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
