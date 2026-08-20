import { writable, type Readable } from "svelte/store";
import {
  DEFAULT_SHELL_SETTINGS,
  readShellSettings,
  writeShellSettings,
  type ShellSettings,
} from "./shell-settings.ts";

export interface ShellSettingsStore extends Readable<ShellSettings> {
  dismissRotationNotice(): void;
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
  };
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
