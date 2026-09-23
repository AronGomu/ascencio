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
}

/* Every setter rebases on persisted state before writing the complete state,
   and a storage failure never interrupts navigation. */
export function createShellSettingsStore(
  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultStorage(),
): ShellSettingsStore {
  const { subscribe, update } = writable<ShellSettings>(
    storage === null ? DEFAULT_SHELL_SETTINGS : readShellSettings(storage),
  );

  // Retain only local mutations until a write succeeds, not a stale snapshot.
  let pending: Partial<ShellSettings> = {};

  function persist(patch: Partial<ShellSettings>): void {
    pending = { ...pending, ...patch };
    update((state) => {
      let current = state;
      if (storage !== null) {
        let readFailed = false;
        const persisted = readShellSettings({
          getItem(key): string | null {
            try {
              return storage.getItem(key);
            } catch {
              readFailed = true;
              return null;
            }
          },
        });
        if (!readFailed) current = persisted;
      }
      const value = Object.freeze({ ...current, ...pending });
      if (storage !== null) {
        writeShellSettings(
          {
            setItem(key, serialized): void {
              storage.setItem(key, serialized);
              pending = {};
            },
          },
          value,
        );
      }
      return value;
    });
  }

  return {
    subscribe,
    dismissRotationNotice(): void {
      persist({ rotationNoticeDismissed: true });
    },
    rememberFreePlayPairing(pairing: FreePlayPairing): void {
      persist({ freePlayPairing: Object.freeze(pairing) });
    },
    rememberFreePlayOpponent(id: string): void {
      persist({ freePlayOpponentId: id });
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
