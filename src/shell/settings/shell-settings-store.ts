import { writable, type Readable } from "svelte/store";
import type {
  AsyncPreferencePort,
  StorageFailure,
} from "../../storage/index.ts";
import {
  DEFAULT_SHELL_SETTINGS,
  type FreePlayPairing,
  type ShellSettings,
} from "./shell-settings.ts";

export interface ShellSettingsStore extends Readable<ShellSettings> {
  dismissRotationNotice(): void;
  rememberFreePlayPairing(pairing: FreePlayPairing): void;
  rememberFreePlayOpponent(id: string): void;
}

export function createShellSettingsStore(
  initial: ShellSettings = DEFAULT_SHELL_SETTINGS,
  persistence: AsyncPreferencePort<ShellSettings> | null = null,
  onFailure: (error: StorageFailure) => void = (error) =>
    console.warn("USER_PERSISTENCE_FAILED", error),
): ShellSettingsStore {
  const { subscribe, update } = writable<ShellSettings>(initial);

  function persist(patch: Partial<ShellSettings>): void {
    update((state) => Object.freeze({ ...state, ...patch }));
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
