import { writable, type Readable } from "svelte/store";

export interface UiSettingsState {
  readonly showDuelHud: boolean;
  readonly showWorkspace: boolean;
  readonly autoPlaceCards: boolean;
  readonly autoResolveTrivialPrompts: boolean;
  readonly showZoneOutlines: boolean;
  readonly showZoneCounts: boolean;
}

export interface UiSettingsStore extends Readable<UiSettingsState> {
  setShowDuelHud(value: boolean): void;
  setShowWorkspace(value: boolean): void;
  setAutoPlaceCards(value: boolean): void;
  setAutoResolveTrivialPrompts(value: boolean): void;
  setShowZoneOutlines(value: boolean): void;
  setShowZoneCounts(value: boolean): void;
  reset(): void;
}

export const DEFAULT_UI_SETTINGS: UiSettingsState = Object.freeze({
  showDuelHud: false,
  showWorkspace: false,
  autoPlaceCards: true,
  autoResolveTrivialPrompts: true,
  showZoneOutlines: true,
  showZoneCounts: true,
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
    setAutoPlaceCards(value: boolean): void {
      update((state) => Object.freeze({ ...state, autoPlaceCards: value }));
    },
    setAutoResolveTrivialPrompts(value: boolean): void {
      update((state) =>
        Object.freeze({ ...state, autoResolveTrivialPrompts: value }),
      );
    },
    setShowZoneOutlines(value: boolean): void {
      update((state) => Object.freeze({ ...state, showZoneOutlines: value }));
    },
    setShowZoneCounts(value: boolean): void {
      update((state) => Object.freeze({ ...state, showZoneCounts: value }));
    },
    reset(): void {
      set(DEFAULT_UI_SETTINGS);
    },
  };
}
