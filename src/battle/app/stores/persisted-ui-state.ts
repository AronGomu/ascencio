import {
  DEFAULT_OPPONENT_DECK_ID,
  DEFAULT_PLAYER_DECK_ID,
} from "../../duel/presets/deck-catalog.ts";

export const PERSISTED_UI_STATE_KEY = "ygo.ui.v2";

export interface PersistedWindowPosition {
  readonly x: number;
  readonly y: number;
}

export interface PersistedDisplaySettings {
  readonly showZoneOutlines: boolean;
  readonly showZoneCounts: boolean;
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

export const DEFAULT_PERSISTED_UI_STATE: PersistedUiState = Object.freeze({
  version: 2,
  windows: Object.freeze({ zoneList: null, confirm: null }),
  decks: Object.freeze({
    playerKey: `preset:${DEFAULT_PLAYER_DECK_ID}`,
    opponentKey: `preset:${DEFAULT_OPPONENT_DECK_ID}`,
  }),
  settings: Object.freeze({ showZoneOutlines: true, showZoneCounts: true }),
});

export function readPersistedUiState(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): PersistedUiState {
  if (storage === null) return DEFAULT_PERSISTED_UI_STATE;
  try {
    const serialized = storage.getItem(PERSISTED_UI_STATE_KEY);
    if (serialized === null) return DEFAULT_PERSISTED_UI_STATE;
    const parsed: unknown = JSON.parse(serialized);
    if (!isPlainObject(parsed) || parsed.version !== 2)
      return DEFAULT_PERSISTED_UI_STATE;
    const decks = isPlainObject(parsed.decks) ? parsed.decks : {};
    const windows = isPlainObject(parsed.windows) ? parsed.windows : {};
    const settings = isPlainObject(parsed.settings) ? parsed.settings : {};
    return Object.freeze({
      version: 2,
      windows: Object.freeze({
        zoneList: windowPosition(windows.zoneList),
        confirm: windowPosition(windows.confirm),
      }),
      decks: Object.freeze({
        playerKey: deckKey(
          decks.playerKey,
          decks.player,
          DEFAULT_PERSISTED_UI_STATE.decks.playerKey,
        ),
        opponentKey: deckKey(
          decks.opponentKey,
          decks.opponent,
          DEFAULT_PERSISTED_UI_STATE.decks.opponentKey,
        ),
      }),
      settings: Object.freeze({
        showZoneOutlines:
          typeof settings.showZoneOutlines === "boolean"
            ? settings.showZoneOutlines
            : true,
        showZoneCounts:
          typeof settings.showZoneCounts === "boolean"
            ? settings.showZoneCounts
            : true,
      }),
    });
  } catch {
    return DEFAULT_PERSISTED_UI_STATE;
  }
}

/**
 * Whether this profile has ever written a UI record.
 *
 * The deck keys cannot answer this on their own: a profile with nothing stored
 * reads back as the built-in defaults, which are indistinguishable from a
 * player who deliberately chose the bundled deck. Only the absence of the
 * record itself says "this player has never picked", which is what lets the
 * duel menu open on the stored default deck on a first run and leave a real
 * choice alone afterwards.
 */
export function hasPersistedUiState(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): boolean {
  try {
    return storage?.getItem(PERSISTED_UI_STATE_KEY) != null;
  } catch {
    return false;
  }
}

export function writePersistedUiState(
  next: PersistedUiState,
  storage: Pick<Storage, "setItem"> | null = defaultStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(PERSISTED_UI_STATE_KEY, JSON.stringify(next));
  } catch {
    // Persistence is best-effort; unavailable storage never blocks play.
  }
}

/* The payload version stays 2 while the deck leaf gains keys: the shell's v3
   settings migrate from this same record and only read `settings`, so bumping
   the version here would make an existing player's display choices look like
   an unknown payload and drop them. A bundled id written by an earlier build
   is read as the preset key it always meant; the id is not validated against
   the catalog, because an unknown key is caught where it matters — the picker
   drops back to the default pair and says so. */
function deckKey(key: unknown, legacyId: unknown, fallback: string): string {
  if (typeof key === "string" && key.length > 0) return key;
  if (typeof legacyId === "string" && legacyId.length > 0)
    return `preset:${legacyId}`;
  return fallback;
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function windowPosition(value: unknown): PersistedWindowPosition | null {
  if (
    !isPlainObject(value) ||
    typeof value.x !== "number" ||
    !Number.isFinite(value.x) ||
    typeof value.y !== "number" ||
    !Number.isFinite(value.y)
  )
    return null;
  return Object.freeze({ x: value.x, y: value.y });
}
