import { writable, type Readable } from "svelte/store";
import {
  DEFAULT_SHELL_SETTINGS,
  readShellSettings,
  writeShellSettings,
  type FreePlayPairing,
  type ShellSettings,
} from "./shell-settings.ts";

export interface ShellSettingsStore extends Readable<ShellSettings> {
  dismissRotationNotice(): void;
  rememberFreePlayPairing(pairing: FreePlayPairing): void;
  rememberFreePlayOpponent(id: string): void;
  setPresetDeckFavourite(id: string, favourite: boolean): void;
}

/* One live owner for shell settings: every setter writes the complete state,
   and a storage failure never interrupts navigation. */
export function createShellSettingsStore(
  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultStorage(),
): ShellSettingsStore {
  const { subscribe, update } = writable<ShellSettings>(
    storage === null ? DEFAULT_SHELL_SETTINGS : readShellSettings(storage),
  );

  function persist(next: (state: ShellSettings) => ShellSettings): void {
    update((state) => {
      const value = next(state);
      if (storage !== null) writeShellSettings(storage, value);
      return value;
    });
  }

  return {
    subscribe,
    dismissRotationNotice(): void {
      persist((state) =>
        Object.freeze({ ...state, rotationNoticeDismissed: true }),
      );
    },
    rememberFreePlayPairing(pairing: FreePlayPairing): void {
      persist((state) =>
        Object.freeze({ ...state, freePlayPairing: Object.freeze(pairing) }),
      );
    },
    rememberFreePlayOpponent(id: string): void {
      persist((state) => Object.freeze({ ...state, freePlayOpponentId: id }));
    },
    /* Starring twice is one star: the list is a set of deck keys, written
       whole so the store and storage never hold different favourites. */
    setPresetDeckFavourite(id: string, favourite: boolean): void {
      persist((state) => {
        const rest = state.freePlayPresetFavouriteIds.filter(
          (key) => key !== id,
        );
        return Object.freeze({
          ...state,
          freePlayPresetFavouriteIds: Object.freeze(
            favourite ? [...rest, id] : rest,
          ),
        });
      });
    },
  };
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
