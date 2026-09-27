import { writable, type Readable } from "svelte/store";
import type {
  AsyncPreferencePort,
  StorageFailure,
} from "../../../storage/index.ts";
import {
  DEFAULT_PERSISTED_UI_STATE,
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

export function createPersistedUiStore(
  initial: PersistedUiState = DEFAULT_PERSISTED_UI_STATE,
  persistence: AsyncPreferencePort<PersistedUiState> | null = null,
  onFailure: (error: StorageFailure) => void = (error) =>
    console.warn("USER_PERSISTENCE_FAILED", error),
): PersistedUiStore {
  const { subscribe, update } = writable<PersistedUiState>(initial);

  function persist(
    patch: Partial<PersistedUiState>,
    next: (state: PersistedUiState) => PersistedUiState,
  ): void {
    update(next);
    if (persistence === null) return;
    void persistence.update(patch).then(
      (result) => {
        if (result.kind === "failed") onFailure(result.error);
      },
      () => onFailure({ code: "STORAGE_UNAVAILABLE" }),
    );
  }

  return {
    subscribe,
    setDecks(playerKey: string, opponentKey: string): void {
      const decks = Object.freeze({ playerKey, opponentKey });
      persist({ decks }, (state) => Object.freeze({ ...state, decks }));
    },
    setDisplaySettings(settings: PersistedDisplaySettings): void {
      const persisted = Object.freeze({ ...settings });
      persist({ settings: persisted }, (state) =>
        Object.freeze({ ...state, settings: persisted }),
      );
    },
    setWindowPosition(
      window: "zoneList" | "confirm",
      position: PersistedWindowPosition | null,
    ): void {
      update((state) => {
        const windows = Object.freeze({ ...state.windows, [window]: position });
        if (persistence !== null)
          void persistence.update({ windows }).then(
            (result) => {
              if (result.kind === "failed") onFailure(result.error);
            },
            () => onFailure({ code: "STORAGE_UNAVAILABLE" }),
          );
        return Object.freeze({ ...state, windows });
      });
    },
  };
}
