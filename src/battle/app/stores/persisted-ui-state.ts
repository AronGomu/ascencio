import { defaultPersistedUiState } from "../../ports/persisted-ui-state-contracts.ts";

export interface PersistedWindowPosition {
  readonly x: number;
  readonly y: number;
}

export interface PersistedDisplaySettings {
  readonly showZoneOutlines: boolean;
  readonly showZoneCounts: boolean;
  readonly showCardShadows: boolean;
  readonly showZoneLabels: boolean;
}

export interface PersistedUiState {
  readonly version: 2;
  readonly windows: {
    readonly zoneList: PersistedWindowPosition | null;
    readonly confirm: PersistedWindowPosition | null;
  };
  /* Selectable-deck keys rather than bundled deck ids, so a seat can name a
     deck the player built. A key records which deck and which revision, never
     a copy of its cards: the deck itself is re-read and re-validated on every
     load, and a deck edited since the last duel resolves to a new key rather
     than silently playing a list nobody assembled. */
  readonly decks: {
    readonly playerKey: string;
    readonly opponentKey: string;
  };
  readonly settings: PersistedDisplaySettings;
}

export const DEFAULT_PERSISTED_UI_STATE: PersistedUiState =
  defaultPersistedUiState();
