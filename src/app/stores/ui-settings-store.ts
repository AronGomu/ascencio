import { writable, type Readable } from "svelte/store";

export interface UiSettingsState {
  readonly showDuelHud: boolean;
  readonly showWorkspace: boolean;
}

export interface UiSettingsStore extends Readable<UiSettingsState> {
  setShowDuelHud(value: boolean): void;
  setShowWorkspace(value: boolean): void;
  reset(): void;
}

export const DEFAULT_UI_SETTINGS: UiSettingsState = Object.freeze({
  showDuelHud: false,
  showWorkspace: false,
});

export function createUiSettingsStore(
  initial: UiSettingsState = DEFAULT_UI_SETTINGS,
): UiSettingsStore {
  const { subscribe, update, set } = writable<UiSettingsState>(
    Object.freeze({ ...initial }),
  );

  return {
    subscribe,
    setShowDuelHud(value: boolean): void {
      update((state) => Object.freeze({ ...state, showDuelHud: value }));
    },
    setShowWorkspace(value: boolean): void {
      update((state) => Object.freeze({ ...state, showWorkspace: value }));
    },
    reset(): void {
      set(DEFAULT_UI_SETTINGS);
    },
  };
}
