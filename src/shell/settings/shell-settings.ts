import {
  PERSISTED_UI_STATE_KEY,
  type PersistedDisplaySettings,
} from "../../battle/app/stores/persisted-ui-state.ts";

export const SHELL_SETTINGS_KEY = "ygo.ui.v3";

/** The last pair of decks a free-play match was started with, as the two
    `SelectableDeck` keys the pickers offered. Keys rather than deck contents:
    a stored deck the player has since edited or deleted must fail to resolve
    against today's library, not duel with yesterday's forty cards. */
export interface FreePlayPairing {
  readonly player: string;
  readonly opponent: string;
}

export interface ShellSettings {
  readonly version: 3;
  /** The duel's one-time "this board is rotated" notice on a portrait phone. */
  readonly rotationNoticeDismissed: boolean;
  /** Carried over from the v2 payload so display choices survive the bump. */
  readonly display: PersistedDisplaySettings;
  /** `null` until a free-play match has been started from the match setup. */
  readonly freePlayPairing: FreePlayPairing | null;
  /** The AI opponent free play was last duelled against; `null` = the default
      persona. An id rather than a persona: which personas exist is the
      roster's question, and a renamed one must read as "none remembered". */
  readonly freePlayOpponentId: string | null;
  /** `SelectableDeck` keys of the starred preset decks. Preset favourites live
      here because `DeckRepository.setFavourite` only covers local decks. */
  readonly freePlayPresetFavouriteIds: readonly string[];
}

const DEFAULT_DISPLAY: PersistedDisplaySettings = Object.freeze({
  showZoneOutlines: true,
  showZoneCounts: true,
});

export const DEFAULT_SHELL_SETTINGS: ShellSettings = Object.freeze({
  version: 3,
  rotationNoticeDismissed: false,
  display: DEFAULT_DISPLAY,
  freePlayPairing: null,
  freePlayOpponentId: null,
  freePlayPresetFavouriteIds: Object.freeze([]),
});

/** Reads v3, falling back to a one-way migration of the v2 payload so an
    existing player keeps their display choices on first load of this shell. */
export function readShellSettings(
  storage: Pick<Storage, "getItem">,
): ShellSettings {
  try {
    const serialized = storage.getItem(SHELL_SETTINGS_KEY);
    if (serialized === null)
      return migrateFromV2(storage.getItem(PERSISTED_UI_STATE_KEY));
    return parseV3(serialized);
  } catch {
    return DEFAULT_SHELL_SETTINGS;
  }
}

export function writeShellSettings(
  storage: Pick<Storage, "setItem">,
  value: ShellSettings,
): void {
  try {
    storage.setItem(SHELL_SETTINGS_KEY, JSON.stringify(value));
  } catch {
    // Persistence is best-effort; unavailable storage never blocks play.
  }
}

export function migrateFromV2(raw: string | null): ShellSettings {
  const parsed = parseJson(raw);
  if (!isPlainObject(parsed) || parsed.version !== 2)
    return DEFAULT_SHELL_SETTINGS;
  return freezeSettings({
    version: 3,
    rotationNoticeDismissed: false,
    display: display(parsed.settings),
    freePlayPairing: null,
    freePlayOpponentId: null,
    freePlayPresetFavouriteIds: [],
  });
}

function parseV3(serialized: string): ShellSettings {
  const parsed = parseJson(serialized);
  if (!isPlainObject(parsed) || parsed.version !== 3)
    return DEFAULT_SHELL_SETTINGS;
  return freezeSettings({
    version: 3,
    rotationNoticeDismissed: boolean(parsed.rotationNoticeDismissed, false),
    display: display(parsed.display),
    freePlayPairing: freePlayPairing(parsed.freePlayPairing),
    freePlayOpponentId: opponentId(parsed.freePlayOpponentId),
    freePlayPresetFavouriteIds: deckKeys(parsed.freePlayPresetFavouriteIds),
  });
}

function freezeSettings(value: ShellSettings): ShellSettings {
  return Object.freeze({
    ...value,
    display: Object.freeze(value.display),
    freePlayPairing:
      value.freePlayPairing === null
        ? null
        : Object.freeze(value.freePlayPairing),
    freePlayPresetFavouriteIds: Object.freeze(value.freePlayPresetFavouriteIds),
  });
}

/* Whether an id still names a persona is the roster's question, not this one:
   it answers that with a fallback, and a shape that is not a name at all never
   reaches it. */
function opponentId(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/* A star on a deck that is gone costs nothing, so unknown keys are kept; a
   blob that is not a list of keys is no favourites at all. */
function deckKeys(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (key): key is string => typeof key === "string" && key !== "",
  );
}

/* A blob written by a build that spelled the pairing differently is no pairing
   at all: both seats are dropped together, because half a remembered match is
   a seat the player never chose. Whether a key still names a deck is the match
   setup's question, not this one — the library it would be checked against is
   an IndexedDB read away. */
function freePlayPairing(value: unknown): FreePlayPairing | null {
  if (!isPlainObject(value)) return null;
  const { player, opponent } = value;
  if (typeof player !== "string" || typeof opponent !== "string") return null;
  if (player === "" || opponent === "") return null;
  return { player, opponent };
}

function display(value: unknown): PersistedDisplaySettings {
  if (!isPlainObject(value)) return DEFAULT_DISPLAY;
  return {
    showZoneOutlines: boolean(value.showZoneOutlines, true),
    showZoneCounts: boolean(value.showZoneCounts, true),
  };
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
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
