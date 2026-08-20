import {
  PERSISTED_UI_STATE_KEY,
  type PersistedDisplaySettings,
} from "../../battle/app/stores/persisted-ui-state.ts";

export const SHELL_SETTINGS_KEY = "ygo.ui.v3";

export interface ShellSettings {
  readonly version: 3;
  /** The duel's one-time "this board is rotated" notice on a portrait phone. */
  readonly rotationNoticeDismissed: boolean;
  /** Carried over from the v2 payload so display choices survive the bump. */
  readonly display: PersistedDisplaySettings;
}

const DEFAULT_DISPLAY: PersistedDisplaySettings = Object.freeze({
  showZoneOutlines: true,
  showZoneCounts: true,
});

export const DEFAULT_SHELL_SETTINGS: ShellSettings = Object.freeze({
  version: 3,
  rotationNoticeDismissed: false,
  display: DEFAULT_DISPLAY,
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
  });
}

function freezeSettings(value: ShellSettings): ShellSettings {
  return Object.freeze({ ...value, display: Object.freeze(value.display) });
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
