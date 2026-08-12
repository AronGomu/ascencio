import {
  DEFAULT_OPPONENT_DECK_ID,
  DEFAULT_PLAYER_DECK_ID,
  isDeckId,
  type DeckId,
} from "../../duel/presets/deck-catalog.ts";

export const PERSISTED_UI_STATE_KEY = "ygo.ui.v1";

export interface PersistedWindowPosition {
  readonly x: number;
  readonly y: number;
}

export interface PersistedUiState {
  readonly version: 1;
  readonly windows: {
    readonly zoneList: PersistedWindowPosition | null;
    readonly confirm: PersistedWindowPosition | null;
  };
  readonly decks: {
    readonly player: DeckId;
    readonly opponent: DeckId;
  };
}

export const DEFAULT_PERSISTED_UI_STATE: PersistedUiState = Object.freeze({
  version: 1,
  windows: Object.freeze({ zoneList: null, confirm: null }),
  decks: Object.freeze({
    player: DEFAULT_PLAYER_DECK_ID,
    opponent: DEFAULT_OPPONENT_DECK_ID,
  }),
});

export function readPersistedUiState(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): PersistedUiState {
  if (storage === null) return DEFAULT_PERSISTED_UI_STATE;
  try {
    const serialized = storage.getItem(PERSISTED_UI_STATE_KEY);
    if (serialized === null) return DEFAULT_PERSISTED_UI_STATE;
    const parsed: unknown = JSON.parse(serialized);
    if (!isPlainObject(parsed) || parsed.version !== 1)
      return DEFAULT_PERSISTED_UI_STATE;
    const decks = isPlainObject(parsed.decks) ? parsed.decks : {};
    const windows = isPlainObject(parsed.windows) ? parsed.windows : {};
    return Object.freeze({
      version: 1,
      windows: Object.freeze({
        zoneList: windowPosition(windows.zoneList),
        confirm: windowPosition(windows.confirm),
      }),
      decks: Object.freeze({
        player:
          typeof decks.player === "string" && isDeckId(decks.player)
            ? decks.player
            : DEFAULT_PLAYER_DECK_ID,
        opponent:
          typeof decks.opponent === "string" && isDeckId(decks.opponent)
            ? decks.opponent
            : DEFAULT_OPPONENT_DECK_ID,
      }),
    });
  } catch {
    return DEFAULT_PERSISTED_UI_STATE;
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
